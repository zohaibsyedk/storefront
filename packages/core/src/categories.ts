import type { Goal } from "./types";

export type ArtDirectionId = "sign_painter" | "market_hall" | "clean_counter";

export interface Category {
  id: string;
  label: string;
  /** Google Business Profile primary category name. */
  gbpCategory: string;
  /** Typical monthly starting budget range in USD, shown as guidance in the wizard. */
  budgetGuide: [number, number];
  interests: string[];
  keywords: string[];
  defaultGoal: Goal;
  artDirection: ArtDirectionId;
  /** Housing / employment / credit: platforms forbid age, gender and ZIP targeting. */
  specialAdCategory?: "housing" | "employment" | "credit";
  offerNoun: string;
}

export const CATEGORIES: Category[] = [
  { id: "bakery", label: "Bakery", gbpCategory: "Bakery", budgetGuide: [300, 900], interests: ["Baking", "Coffee", "Brunch", "Farmers markets", "Birthday parties", "Weddings"], keywords: ["bakery near me", "fresh bread", "custom cakes", "pastries", "birthday cake"], defaultGoal: "foot_traffic", artDirection: "sign_painter", offerNoun: "bake" },
  { id: "cafe", label: "Coffee shop / café", gbpCategory: "Coffee shop", budgetGuide: [300, 900], interests: ["Coffee", "Remote work", "Brunch", "Tea", "Live music"], keywords: ["coffee near me", "espresso", "cafe with wifi", "latte"], defaultGoal: "foot_traffic", artDirection: "sign_painter", offerNoun: "drink" },
  { id: "restaurant", label: "Restaurant", gbpCategory: "Restaurant", budgetGuide: [500, 2000], interests: ["Dining out", "Date night", "Family dinners", "Food delivery", "Wine"], keywords: ["restaurants near me", "dinner reservations", "best lunch", "takeout"], defaultGoal: "bookings", artDirection: "market_hall", offerNoun: "dish" },
  { id: "food_truck", label: "Food truck / catering", gbpCategory: "Caterer", budgetGuide: [300, 1200], interests: ["Street food", "Events", "Office lunches", "Weddings"], keywords: ["catering near me", "food truck", "event catering", "office lunch catering"], defaultGoal: "leads", artDirection: "market_hall", offerNoun: "menu" },
  { id: "salon", label: "Hair salon / barber", gbpCategory: "Hair salon", budgetGuide: [300, 1000], interests: ["Hair care", "Beauty", "Weddings", "Self-care"], keywords: ["hair salon near me", "haircut", "balayage", "barber"], defaultGoal: "bookings", artDirection: "clean_counter", offerNoun: "service" },
  { id: "nails_spa", label: "Nail salon / spa", gbpCategory: "Nail salon", budgetGuide: [300, 1000], interests: ["Beauty", "Self-care", "Spa days", "Bridal"], keywords: ["nail salon near me", "manicure", "pedicure", "massage"], defaultGoal: "bookings", artDirection: "clean_counter", offerNoun: "treatment" },
  { id: "fitness", label: "Gym / fitness studio", gbpCategory: "Fitness center", budgetGuide: [500, 2000], interests: ["Fitness", "Yoga", "Running", "Healthy eating"], keywords: ["gym near me", "yoga classes", "personal trainer", "pilates"], defaultGoal: "leads", artDirection: "clean_counter", offerNoun: "class" },
  { id: "plumber", label: "Plumber", gbpCategory: "Plumber", budgetGuide: [600, 2500], interests: ["Home improvement", "Homeowners", "Property management"], keywords: ["plumber near me", "emergency plumber", "water heater repair", "drain cleaning"], defaultGoal: "calls", artDirection: "clean_counter", offerNoun: "job" },
  { id: "electrician", label: "Electrician", gbpCategory: "Electrician", budgetGuide: [600, 2500], interests: ["Home improvement", "Homeowners", "EV owners"], keywords: ["electrician near me", "panel upgrade", "ev charger install", "lighting installation"], defaultGoal: "calls", artDirection: "clean_counter", offerNoun: "job" },
  { id: "hvac", label: "Heating & cooling", gbpCategory: "HVAC contractor", budgetGuide: [800, 3000], interests: ["Homeowners", "Home improvement", "Energy savings"], keywords: ["ac repair near me", "furnace repair", "hvac installation", "heat pump"], defaultGoal: "calls", artDirection: "clean_counter", offerNoun: "job" },
  { id: "landscaping", label: "Landscaping / lawn care", gbpCategory: "Landscaper", budgetGuide: [400, 1500], interests: ["Gardening", "Homeowners", "Outdoor living"], keywords: ["landscaping near me", "lawn care", "yard cleanup", "garden design"], defaultGoal: "leads", artDirection: "market_hall", offerNoun: "service" },
  { id: "cleaning", label: "Cleaning service", gbpCategory: "House cleaning service", budgetGuide: [400, 1500], interests: ["Busy parents", "Homeowners", "Short-term rentals"], keywords: ["house cleaning near me", "maid service", "deep cleaning", "move out cleaning"], defaultGoal: "leads", artDirection: "clean_counter", offerNoun: "clean" },
  { id: "auto_repair", label: "Auto repair", gbpCategory: "Auto repair shop", budgetGuide: [500, 2000], interests: ["Car owners", "Commuters", "Road trips"], keywords: ["auto repair near me", "oil change", "brake repair", "mechanic"], defaultGoal: "calls", artDirection: "sign_painter", offerNoun: "service" },
  { id: "dentist", label: "Dental practice", gbpCategory: "Dentist", budgetGuide: [800, 3000], interests: ["Families", "Health", "Cosmetic dentistry"], keywords: ["dentist near me", "teeth cleaning", "emergency dentist", "teeth whitening"], defaultGoal: "bookings", artDirection: "clean_counter", offerNoun: "visit" },
  { id: "pet", label: "Pet grooming / care", gbpCategory: "Pet groomer", budgetGuide: [300, 1000], interests: ["Dog owners", "Cat owners", "Pet adoption"], keywords: ["dog groomer near me", "pet boarding", "dog daycare", "mobile grooming"], defaultGoal: "bookings", artDirection: "market_hall", offerNoun: "service" },
  { id: "retail", label: "Shop / boutique", gbpCategory: "Boutique", budgetGuide: [300, 1200], interests: ["Shopping", "Gifts", "Local makers", "Fashion"], keywords: ["gift shop near me", "boutique", "local shop", "handmade gifts"], defaultGoal: "foot_traffic", artDirection: "sign_painter", offerNoun: "item" },
  { id: "florist", label: "Florist", gbpCategory: "Florist", budgetGuide: [300, 1000], interests: ["Weddings", "Gifts", "Gardening", "Events"], keywords: ["florist near me", "flower delivery", "wedding flowers", "bouquet"], defaultGoal: "online_orders", artDirection: "market_hall", offerNoun: "arrangement" },
  { id: "photography", label: "Photographer", gbpCategory: "Photographer", budgetGuide: [300, 1200], interests: ["Weddings", "New parents", "Graduations", "Small business"], keywords: ["photographer near me", "wedding photographer", "family photos", "headshots"], defaultGoal: "leads", artDirection: "clean_counter", offerNoun: "session" },
  { id: "tutoring", label: "Tutoring / classes", gbpCategory: "Tutoring service", budgetGuide: [300, 1200], interests: ["Parents", "Test prep", "Music lessons", "After-school"], keywords: ["tutor near me", "math tutoring", "sat prep", "music lessons"], defaultGoal: "leads", artDirection: "clean_counter", offerNoun: "lesson" },
  { id: "real_estate", label: "Real estate agent", gbpCategory: "Real estate agent", budgetGuide: [800, 3000], interests: ["Home buyers", "Moving", "Investing"], keywords: ["realtor near me", "homes for sale", "sell my house", "real estate agent"], defaultGoal: "leads", artDirection: "clean_counter", specialAdCategory: "housing", offerNoun: "listing" },
  { id: "staffing", label: "Staffing / recruiting", gbpCategory: "Employment agency", budgetGuide: [800, 3000], interests: ["Job seekers", "Hiring managers"], keywords: ["staffing agency", "temp agency near me", "recruiters"], defaultGoal: "leads", artDirection: "clean_counter", specialAdCategory: "employment", offerNoun: "placement" },
  { id: "lending", label: "Loans / financial services", gbpCategory: "Loan agency", budgetGuide: [1000, 4000], interests: ["Small business owners", "Home buyers"], keywords: ["small business loan", "mortgage broker near me"], defaultGoal: "leads", artDirection: "clean_counter", specialAdCategory: "credit", offerNoun: "product" },
  { id: "other", label: "Something else", gbpCategory: "Local business", budgetGuide: [300, 1500], interests: ["Local events", "Shopping", "Families"], keywords: ["near me"], defaultGoal: "leads", artDirection: "market_hall", offerNoun: "service" },
];

export function categoryById(id: string | undefined): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
