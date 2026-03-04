import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { getProperties, getMonthlyReport, getSalesReport } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, FileText, DollarSign, Calendar, TrendingUp, Package, Trophy } from "lucide-react";

export default function AdminReports() {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [reportType, setReportType] = useState("all"); // "all" or "sales"

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const data = await getProperties();
      setProperties(data);
      if (data.length > 0) setSelectedProperty(data[0].property_id);
    } catch (error) {
      toast.error("Failed to load properties");
    }
  };

  const generateReport = async () => {
    if (!selectedProperty) {
      toast.error("Please select a property");
      return;
    }
    
    setLoading(true);
    try {
      const data = reportType === "sales" 
        ? await getSalesReport(selectedProperty, selectedMonth, selectedYear)
        : await getMonthlyReport(selectedProperty, selectedMonth, selectedYear);
      setReport(data);
      toast.success("Report generated successfully");
    } catch (error) {
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.error("No data to download");
      return;
    }
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(h => {
        let val = row[h];
        if (typeof val === "object") val = JSON.stringify(val);
        if (typeof val === "string" && val.includes(",")) val = `"${val}"`;
        return val ?? "";
      }).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFullReport = () => {
    if (!report) return;
    
    const filename = `${report.property_name}_${report.period}_${reportType === "sales" ? "Sales" : "Full"}_Report.csv`;
    
    if (reportType === "sales") {
      // Sales report - include summary with top 3 items
      const top3Info = report.top_3_items?.map((item, i) => 
        `#${i+1}: ${item.name} (${item.quantity} units, ₹${item.revenue})`
      ).join(" | ") || "N/A";
      
      const summaryData = [{
        "Report Type": "Sales Report",
        "Property": report.property_name,
        "Period": report.period,
        "Food Revenue": `₹${report.revenue?.food_orders || 0}`,
        "Experience Revenue": `₹${report.revenue?.experiences || 0}`,
        "Net Sales (Total Revenue)": `₹${report.revenue?.total || 0}`,
        "Paid Orders": report.counts?.paid_orders || 0,
        "Total Units Sold": report.counts?.total_units_sold || 0,
        "Completed Bookings": report.counts?.completed_bookings || 0,
        "Top 3 Items": top3Info,
      }];
      downloadCSV(summaryData, filename);
    } else {
      // Full report
      const summaryData = [{
        "Report Type": "Monthly Report",
        "Property": report.property_name,
        "Period": report.period,
        "Total Orders": report.summary?.total_orders || 0,
        "Total Bookings": report.summary?.total_bookings || 0,
        "Total Requests": report.summary?.total_requests || 0,
      }];
      downloadCSV(summaryData, filename);
    }
  };

  const downloadOrders = () => {
    if (!report?.orders?.length) {
      toast.error("No orders data");
      return;
    }
    
    const ordersData = report.orders.map(o => ({
      "Order ID": o.id?.slice(0, 8).toUpperCase(),
      "Date": o.created_at?.slice(0, 10),
      "Guest": o.guest_name,
      "Room": o.room_number,
      "Items": o.items?.map(i => `${i.name} x${i.quantity}`).join("; "),
      "Total": `₹${o.total}`,
      "Status": o.status,
    }));
    
    downloadCSV(ordersData, `${report.property_name}_${report.period}_Orders.csv`);
  };

  const downloadUnitItems = () => {
    if (!report?.unit_items?.length) {
      toast.error("No unit items data");
      return;
    }
    
    const unitData = report.unit_items.map(u => ({
      "Order ID": u.order_id,
      "Date": u.date,
      "Guest": u.guest_name,
      "Room": u.room_number,
      "Item Name": u.item_name,
      "Unit #": u.unit_number,
      "Qty in Order": u.quantity_in_order,
      "Unit Price": `₹${u.unit_price}`,
    }));
    
    downloadCSV(unitData, `${report.property_name}_${report.period}_Unit_Sales.csv`);
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <AdminLayout title="Reports">
      <div className="space-y-6" data-testid="admin-reports">
        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="text-sm font-medium text-[#2D3436] block mb-2">Property</label>
                <select
                  value={selectedProperty}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="hm-input"
                  data-testid="report-property"
                >
                  {properties.map(p => (
                    <option key={p.property_id} value={p.property_id}>{p.property_name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-[#2D3436] block mb-2">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="hm-input"
                  data-testid="report-month"
                >
                  {months.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-[#2D3436] block mb-2">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="hm-input"
                  data-testid="report-year"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-[#2D3436] block mb-2">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="hm-input"
                  data-testid="report-type"
                >
                  <option value="all">All Data Report</option>
                  <option value="sales">Sales Report</option>
                </select>
              </div>
              
              <Button 
                onClick={generateReport} 
                className="btn-primary h-11"
                disabled={loading}
                data-testid="generate-report"
              >
                {loading ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Display */}
        {report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {reportType === "sales" ? (
                <>
                  <Card className="bg-gradient-to-br from-[#0D7377]/10 to-[#14919B]/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-[#0D7377]" />
                        <div>
                          <p className="text-sm text-[#636E72]">Net Sales (Total Revenue)</p>
                          <p className="text-2xl font-bold text-[#0D7377]">₹{report.revenue?.total || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-[#FFC107]" />
                        <div>
                          <p className="text-sm text-[#636E72]">Food Revenue</p>
                          <p className="text-2xl font-bold text-[#2D3436]">₹{report.revenue?.food_orders || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Package className="w-8 h-8 text-[#F9A825]" />
                        <div>
                          <p className="text-sm text-[#636E72]">Total Units Sold</p>
                          <p className="text-2xl font-bold text-[#2D3436]">{report.counts?.total_units_sold || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-[#6BB8B2]" />
                        <div>
                          <p className="text-sm text-[#636E72]">Paid Orders</p>
                          <p className="text-2xl font-bold text-[#2D3436]">{report.counts?.paid_orders || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-[#636E72]">Total Orders</p>
                      <p className="text-2xl font-bold text-[#0D7377]">{report.summary?.total_orders || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-[#636E72]">Total Bookings</p>
                      <p className="text-2xl font-bold text-[#FFC107]">{report.summary?.total_bookings || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-[#636E72]">Total Requests</p>
                      <p className="text-2xl font-bold text-[#F9A825]">{report.summary?.total_requests || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-[#636E72]">Period</p>
                      <p className="text-lg font-bold text-[#2D3436]">{report.period}</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Top 3 Best Sellers (Sales Report) */}
            {reportType === "sales" && report.top_3_items?.length > 0 && (
              <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-amber-700 flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Top 3 Best Selling Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {report.top_3_items.map((item, i) => (
                      <div 
                        key={i} 
                        className={`p-4 rounded-lg border-2 ${
                          i === 0 ? 'bg-amber-100 border-amber-400' : 
                          i === 1 ? 'bg-gray-100 border-gray-400' : 
                          'bg-orange-100 border-orange-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-2xl font-bold ${
                            i === 0 ? 'text-amber-600' : 
                            i === 1 ? 'text-gray-600' : 
                            'text-orange-600'
                          }`}>
                            #{i + 1}
                          </span>
                          <span className="text-lg font-semibold text-[#2D3436]">{item.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#636E72]">Units Sold: <strong>{item.quantity}</strong></span>
                          <span className="text-[#0D7377] font-semibold">₹{item.revenue}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Download Buttons */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-[#0D7377]">Download Reports</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button onClick={downloadFullReport} className="btn-primary" data-testid="download-summary">
                  <Download className="w-4 h-4 mr-2" />
                  Download Summary
                </Button>
                <Button onClick={downloadOrders} className="btn-secondary" data-testid="download-orders">
                  <Download className="w-4 h-4 mr-2" />
                  Download Orders ({report.orders?.length || 0})
                </Button>
                {reportType === "sales" && report.unit_items?.length > 0 && (
                  <Button 
                    onClick={downloadUnitItems} 
                    variant="outline"
                    className="border-[#0D7377] text-[#0D7377] hover:bg-[#0D7377]/10"
                    data-testid="download-unit-items"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Unit Sales ({report.unit_items.length} entries)
                  </Button>
                )}
                {reportType === "sales" && report.top_selling_items?.length > 0 && (
                  <Button 
                    onClick={() => downloadCSV(report.top_selling_items, `${report.property_name}_${report.period}_TopItems.csv`)} 
                    variant="outline"
                    data-testid="download-top-items"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Top Selling Items
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Unit Items Table (Sales Report) - Individual entries per unit */}
            {reportType === "sales" && report.unit_items?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-[#0D7377]">
                    Unit-Level Sales ({report.unit_items.length} entries)
                  </CardTitle>
                  <p className="text-sm text-[#636E72]">
                    Each row represents one unit sold. If 2 pieces were ordered, there are 2 entries.
                  </p>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Guest</th>
                        <th>Room</th>
                        <th>Item</th>
                        <th>Unit #</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.unit_items.slice(0, 30).map((unit, idx) => (
                        <tr key={idx}>
                          <td className="font-mono text-sm">{unit.order_id}</td>
                          <td>{unit.date}</td>
                          <td>{unit.guest_name}</td>
                          <td>{unit.room_number}</td>
                          <td className="font-medium">{unit.item_name}</td>
                          <td className="text-center">
                            <span className="bg-[#0D7377]/10 text-[#0D7377] px-2 py-1 rounded text-sm">
                              {unit.unit_number}/{unit.quantity_in_order}
                            </span>
                          </td>
                          <td className="font-semibold">₹{unit.unit_price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {report.unit_items.length > 30 && (
                    <p className="text-sm text-[#636E72] mt-3">
                      Showing 30 of {report.unit_items.length} entries. Download CSV for full list.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Top Selling Items (Sales Report) */}
            {reportType === "sales" && report.top_selling_items?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-[#0D7377]">All Items Sales Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Quantity Sold</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.top_selling_items.map((item, i) => (
                        <tr key={i}>
                          <td className="font-medium">{item.name}</td>
                          <td>{item.quantity}</td>
                          <td className="text-[#0D7377] font-semibold">₹{item.revenue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Orders Table */}
            {report.orders?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-[#0D7377]">
                    {reportType === "sales" ? "Paid Orders" : "All Orders"} ({report.orders.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Guest</th>
                        <th>Room</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.orders.slice(0, 20).map((order) => (
                        <tr key={order.id}>
                          <td className="font-mono text-sm">{order.id?.slice(0, 8).toUpperCase()}</td>
                          <td>{order.created_at?.slice(0, 10)}</td>
                          <td>{order.guest_name}</td>
                          <td>{order.room_number}</td>
                          <td className="text-sm max-w-xs truncate">
                            {order.items?.map(i => `${i.name} x${i.quantity}`).join(", ")}
                          </td>
                          <td className="font-semibold">₹{order.total}</td>
                          <td>
                            <span className={`status-badge status-${order.status}`}>{order.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {report.orders.length > 20 && (
                    <p className="text-sm text-[#636E72] mt-3">
                      Showing 20 of {report.orders.length} orders. Download CSV for full list.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
