import type { OnboardingDraft } from "@storefront/core";

const hours = (open: string, close: string, closed = false) => ({ open, close, closed });

/** The fictional bakery from the MVP definition of done. Used by the demo script, tests and the "use an example" button. */
export function bakeryDraft(startDate = new Date().toISOString().slice(0, 10)): OnboardingDraft {
  return {
    services: { website: true, google: true, apple: false, hasWebsite: false, hasGoogleListing: false, hasAppleListing: false, confirmed: true },
    basics: { name: "Marigold Bakehouse", category: "bakery", description: "Sourdough, morning buns and celebration cakes, baked from scratch on Alder Street every day before sunrise." },
    offerings: {
      offerings: [
        { id: "o1", name: "Country sourdough", description: "Naturally leavened, 36-hour ferment", priceType: "fixed", price: 9 },
        { id: "o2", name: "Morning bun", description: "Orange zest and cinnamon sugar", priceType: "fixed", price: 4.5 },
        { id: "o3", name: "Celebration cakes", description: "Made to order, 48 hours' notice", priceType: "from", price: 65 },
        { id: "o4", name: "Coffee and pastry catering", description: "For offices and events, 12 people or more", priceType: "quote" },
      ],
    },
    location: {
      mode: "storefront",
      address: "214 Alder Street",
      city: "Portland",
      region: "OR",
      postal: "97205",
      hideAddress: false,
      radiusMiles: 5,
      areas: [],
      hours: { mon: hours("07:00", "15:00", true), tue: hours("07:00", "15:00"), wed: hours("07:00", "15:00"), thu: hours("07:00", "15:00"), fri: hours("07:00", "16:00"), sat: hours("07:00", "16:00"), sun: hours("08:00", "14:00") },
    },
    contact: { phone: "(503) 555-0142", email: "hello@marigoldbakehouse.example", instagram: "@marigoldbakehouse" },
    photos: { photos: [] },
    customers: { ageRanges: ["25-34", "35-44"], gender: "any", reach: "local", radiusMiles: 5, languages: ["English"], interests: ["Baking", "Coffee", "Brunch"], bestCustomer: "Neighbours who stop in on the way to work and order a cake twice a year." },
    budget: { totalUsd: 1500, startDate, months: 3, renew: false, goal: "foot_traffic" },
    lastStep: 8,
  };
}
