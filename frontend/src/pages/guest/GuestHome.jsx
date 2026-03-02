import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, UtensilsCrossed, MessageSquare, Wifi, Clock, Calendar, MapPin, Coffee, User } from "lucide-react";
import GuestLayout from "@/components/GuestLayout";
import api, { getSettings, seedData } from "@/lib/api";
import { getPropertyId } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";

// Flip Card Component
const FlipCard = ({ item, type }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  
  return (
    <div 
      className="flip-card cursor-pointer h-[200px] perspective-1000"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={`flip-card-inner relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
        {/* Front */}
        <div className="flip-card-front absolute w-full h-full backface-hidden rounded-xl overflow-hidden shadow-md">
          <div className="relative h-full">
            {item.image_url ? (
              <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full ${type === 'food' ? 'bg-gradient-to-br from-[#F4A261] to-[#E76F51]' : 'bg-gradient-to-br from-[#0D7377] to-[#14919B]'}`} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h3 className="font-semibold text-lg">{item.title}</h3>
              <p className="text-sm opacity-80 line-clamp-2">{item.description}</p>
              <p className="text-xs mt-2 opacity-60">Tap for details</p>
            </div>
          </div>
        </div>
        
        {/* Back */}
        <div className={`flip-card-back absolute w-full h-full backface-hidden rounded-xl overflow-hidden shadow-md rotate-y-180 ${type === 'food' ? 'bg-gradient-to-br from-[#F4A261] to-[#E76F51]' : 'bg-gradient-to-br from-[#0D7377] to-[#14919B]'}`}>
          <div className="p-4 h-full flex flex-col text-white">
            <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
            <p className="text-sm flex-1 overflow-auto">{item.description}</p>
            {item.location && (
              <p className="text-sm mt-2 flex items-center gap-1">
                <MapPin className="w-4 h-4" /> {item.location}
              </p>
            )}
            {item.price_range && (
              <p className="text-sm mt-1">Price: {item.price_range}</p>
            )}
            {item.timing && (
              <p className="text-sm mt-1">Timing: {item.timing}</p>
            )}
            {item.tips && (
              <p className="text-xs mt-2 italic opacity-80">Tip: {item.tips}</p>
            )}
            <p className="text-xs mt-2 opacity-60">Tap to flip back</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function GuestHome() {
  const navigate = useNavigate();
  const propertyId = getPropertyId();
  const [settings, setSettings] = useState(null);
  const [propertyInfo, setPropertyInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await seedData();
        const settingsData = await getSettings(propertyId);
        setSettings(settingsData);
        
        // Get property info
        const infoRes = await api.get(`/property-info/${propertyId}`);
        setPropertyInfo(infoRes.data);
      } catch (error) {
        console.error("Error initializing:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [propertyId]);

  // Default images
  const defaultImages = {
    experiences: "https://images.unsplash.com/photo-1590091014590-70dfccb5295e?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    food: "https://images.pexels.com/photos/7420939/pexels-photo-7420939.jpeg?auto=compress&cs=tinysrgb&w=800",
    requests: "https://images.pexels.com/photos/32501209/pexels-photo-32501209.jpeg?auto=compress&cs=tinysrgb&w=800",
    header: "https://images.unsplash.com/photo-1683914791867-7d65ac8893de?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
  };

  const modules = [
    {
      id: "experiences",
      title: "Experiences",
      subtitle: "Curated adventures & activities",
      icon: Compass,
      image: propertyInfo?.experiences_header_image || defaultImages.experiences,
      path: "/experiences",
      color: "from-[#0D7377]/80 to-[#14919B]/90",
    },
    {
      id: "food",
      title: "Food & Drinks",
      subtitle: "Fresh, local, delicious",
      icon: UtensilsCrossed,
      image: propertyInfo?.food_header_image || defaultImages.food,
      path: "/food",
      color: "from-[#F4A261]/80 to-[#E76F51]/90",
    },
    {
      id: "requests",
      title: "Requests",
      subtitle: "How can we help?",
      icon: MessageSquare,
      image: propertyInfo?.requests_header_image || defaultImages.requests,
      path: "/requests",
      color: "from-[#2D3436]/80 to-[#0D7377]/90",
    },
  ];

  return (
    <GuestLayout>
      <div className="min-h-screen" data-testid="guest-home">
        {/* Staff Login - Top Corner */}
        <button
          onClick={() => navigate(`/staff/login?property=${propertyId}`)}
          className="fixed top-4 right-4 z-50 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white transition-colors"
          data-testid="staff-login-btn"
          title="Staff Login"
        >
          <User className="w-4 h-4 text-[#0D7377]" />
        </button>

        {/* Hero Section with Logo */}
        <div className="relative h-[38vh] min-h-[300px] overflow-hidden">
          <img
            src={propertyInfo?.header_image || defaultImages.header}
            alt="Hidden Monkey Stays"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0D7377]/40 via-[#0D7377]/60 to-[#2D3436]/95" />
          
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12">
            {/* Mascot Logo */}
            <div className="absolute top-4 left-4 md:top-6 md:left-6">
              <img 
                src="/mascot.png" 
                alt="Hidden Monkey" 
                className="w-14 h-14 md:w-16 md:h-16 object-contain mascot-float"
              />
            </div>
            
            <p className="font-accent text-[#F4A261] text-lg md:text-xl mb-1 animate-fade-in">
              {propertyInfo?.welcome_message || "Welcome to"}
            </p>
            <h1 
              className="text-3xl md:text-5xl text-white mb-1 animate-fade-in-up font-bold"
              style={{fontFamily: "'Quicksand', sans-serif"}}
              data-testid="property-name"
            >
              {loading ? "Hidden Monkey" : (settings?.property_name || "Hidden Monkey")}
            </h1>
            {settings?.property_location && (
              <p className="text-white/70 text-sm md:text-base flex items-center gap-1">
                <MapPin className="w-4 h-4" /> {settings.property_location}
              </p>
            )}
          </div>
        </div>

        {/* Property Info Cards */}
        {propertyInfo && (
          <div className="px-4 md:px-8 -mt-6 relative z-10 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-white/90 backdrop-blur-sm border-none shadow-md">
                <CardContent className="p-3 text-center">
                  <Clock className="w-5 h-5 mx-auto text-[#0D7377] mb-1" />
                  <p className="text-xs text-gray-500">Check-in</p>
                  <p className="font-semibold text-sm text-[#2D3436]">{propertyInfo.checkin_time || "2:00 PM"}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/90 backdrop-blur-sm border-none shadow-md">
                <CardContent className="p-3 text-center">
                  <Clock className="w-5 h-5 mx-auto text-[#E76F51] mb-1" />
                  <p className="text-xs text-gray-500">Check-out</p>
                  <p className="font-semibold text-sm text-[#2D3436]">{propertyInfo.checkout_time || "11:00 AM"}</p>
                </CardContent>
              </Card>
              {propertyInfo.wifi_name && (
                <>
                  <Card className="bg-white/90 backdrop-blur-sm border-none shadow-md">
                    <CardContent className="p-3 text-center">
                      <Wifi className="w-5 h-5 mx-auto text-[#F4A261] mb-1" />
                      <p className="text-xs text-gray-500">WiFi</p>
                      <p className="font-semibold text-sm text-[#2D3436] truncate">{propertyInfo.wifi_name}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/90 backdrop-blur-sm border-none shadow-md">
                    <CardContent className="p-3 text-center">
                      <Wifi className="w-5 h-5 mx-auto text-[#6BB8B2] mb-1" />
                      <p className="text-xs text-gray-500">Password</p>
                      <p className="font-semibold text-sm text-[#2D3436] truncate">{propertyInfo.wifi_password}</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}

        {/* Today's Events */}
        {propertyInfo?.today_events?.length > 0 && (
          <div className="px-4 md:px-8 mb-6">
            <h2 className="text-xl text-[#0D7377] mb-3 flex items-center gap-2 font-bold" style={{fontFamily: "'Quicksand', sans-serif"}}>
              <Calendar className="w-5 h-5 text-[#0D7377]" /> Today's Events
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {propertyInfo.today_events.map((event, i) => (
                <Card key={i} className="min-w-[200px] bg-gradient-to-br from-[#0D7377]/10 to-[#F4A261]/10 border-none">
                  <CardContent className="p-4">
                    <p className="font-semibold text-[#2D3436]">{event.title}</p>
                    <p className="text-sm text-[#0D7377]">{event.time}</p>
                    {event.description && <p className="text-xs text-gray-600 mt-1">{event.description}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Module Cards */}
        <div className="px-4 md:px-8 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {modules
              .filter(module => {
                // Filter based on toggles from settings
                if (module.id === "experiences" && settings?.experiences_enabled === false) return false;
                if (module.id === "requests" && settings?.requests_enabled === false) return false;
                return true;
              })
              .map((module) => (
              <button
                key={module.id}
                onClick={() => navigate(`${module.path}?property=${propertyId}`)}
                className="guest-card group text-left overflow-hidden rounded-xl"
                data-testid={`module-${module.id}`}
              >
                <div className="relative h-40 md:h-48 overflow-hidden">
                  <img
                    src={module.image}
                    alt={module.title}
                    className="w-full h-full object-cover img-zoom"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${module.color} opacity-60 group-hover:opacity-70 transition-opacity duration-300`} />
                  <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <module.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="p-4">
                  <h2 className="text-xl text-[#2D3436] mb-1 font-bold" style={{fontFamily: "'Quicksand', sans-serif"}}>{module.title}</h2>
                  <p className="text-sm text-[#636E72]">{module.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Things to Do Section */}
        {propertyInfo?.things_to_do?.length > 0 && (
          <div className="px-4 md:px-8 mb-8">
            <h2 className="text-xl text-[#0D7377] mb-4 flex items-center gap-2 font-bold" style={{fontFamily: "'Quicksand', sans-serif"}}>
              <MapPin className="w-5 h-5 text-[#0D7377]" /> Things to Do
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {propertyInfo.things_to_do.map((item, i) => (
                <FlipCard key={i} item={item} type="things" />
              ))}
            </div>
          </div>
        )}

        {/* Food to Try Section */}
        {propertyInfo?.food_to_try?.length > 0 && (
          <div className="px-4 md:px-8 pb-8">
            <h2 className="text-xl text-[#E76F51] mb-4 flex items-center gap-2 font-bold" style={{fontFamily: "'Quicksand', sans-serif"}}>
              <Coffee className="w-5 h-5 text-[#F4A261]" /> Where to Eat & What to Try
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {propertyInfo.food_to_try.map((item, i) => (
                <FlipCard key={i} item={item} type="food" />
              ))}
            </div>
          </div>
        )}
      </div>
    </GuestLayout>
  );
}
