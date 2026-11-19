import { Bowlby_One, Fraunces, Karla, Schibsted_Grotesk, Work_Sans } from "next/font/google";

const bowlby = Bowlby_One({ weight: "400", subsets: ["latin"], variable: "--font-bowlby" });
const karla = Karla({ subsets: ["latin"], variable: "--font-karla" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const worksans = Work_Sans({ subsets: ["latin"], variable: "--font-worksans" });
const schibsted = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted" });

/** Fonts used by the art directions (generated sites and ad previews). */
export const siteFontVars = `${bowlby.variable} ${karla.variable} ${fraunces.variable} ${worksans.variable} ${schibsted.variable}`;
