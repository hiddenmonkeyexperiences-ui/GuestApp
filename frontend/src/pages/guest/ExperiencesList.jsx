import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Sparkles } from "lucide-react";
import GuestLayout from "@/components/GuestLayout";
import { getExperiences } from "@/lib/api";
import { getPropertyId } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExperiencesList() {
  const navigate = useNavigate();
  const propertyId = getPropertyId();
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        const data = await getExperiences(propertyId);
        setExperiences(data);
      } catch (error) {
        console.error("Error fetching experiences:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchExperiences();
  }, [propertyId]);

  const categories = ["all", ...new Set(experiences.map((e) => e.category))];
  
  const filteredExperiences = activeCategory === "all" 
    ? experiences 
    : experiences.filter((e) => e.category === activeCategory);

  return (
    <GuestLayout>
      <div className="min-h-screen" data-testid="experiences-list">
        {/* Header */}
        <div className="page-header bg-white border-b border-[#E0DCD3]">
          <button
            onClick={() => navigate(`/?property=${propertyId}`)}
            className="flex items-center gap-2 text-[#6B705C] mb-4 hover:text-[#2A9D8F] transition-colors"
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 data-testid="page-title">Experiences</h1>
          <p>Discover curated adventures & activities</p>
        </div>

        {/* Categories */}
        <div className="px-6 py-4 overflow-x-auto">
          <div className="flex gap-3" data-testid="category-filters">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`category-pill whitespace-nowrap capitalize ${
                  activeCategory === category ? "active" : ""
                }`}
                data-testid={`category-${category}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Experiences Grid */}
        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="guest-card">
                  <Skeleton className="h-48 w-full" />
                  <div className="p-6">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredExperiences.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="w-12 h-12 text-[#E9C46A] mx-auto mb-4" />
              <p className="text-[#6B705C]">No experiences available at the moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
              {filteredExperiences.map((experience) => (
                <button
                  key={experience.id}
                  onClick={() => navigate(`/experiences/${experience.id}?property=${propertyId}`)}
                  className="guest-card group text-left"
                  data-testid={`experience-card-${experience.id}`}
                >
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={experience.image_url}
                      alt={experience.title}
                      className="w-full h-full object-cover img-zoom"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#264653]/60 to-transparent" />
                    
                    {/* Category Badge */}
                    <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/90 text-[#264653] text-xs font-semibold uppercase tracking-wider">
                      {experience.category}
                    </span>

                    {/* Price */}
                    {experience.price && (
                      <span className="absolute bottom-4 right-4 px-3 py-1 rounded-full bg-[#E9C46A] text-[#264653] font-semibold">
                        {experience.price}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="font-serif text-xl text-[#264653] mb-2 group-hover:text-[#2A9D8F] transition-colors">
                      {experience.title}
                    </h3>
                    <p className="text-[#6B705C] text-sm line-clamp-2 mb-3">
                      {experience.description}
                    </p>
                    
                    {experience.duration && (
                      <div className="flex items-center gap-2 text-[#6B705C] text-sm">
                        <Clock className="w-4 h-4" />
                        <span>{experience.duration}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </GuestLayout>
  );
}
