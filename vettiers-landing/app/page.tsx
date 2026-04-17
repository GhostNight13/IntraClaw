import { Header } from "@/components/site/Header";
import { Hero } from "@/components/site/Hero";
import { Problem } from "@/components/site/Problem";
import { Solution } from "@/components/site/Solution";
import { ProductPreview } from "@/components/site/ProductPreview";
import { Compatibility } from "@/components/site/Compatibility";
import { Pricing } from "@/components/site/Pricing";
import { FounderNote } from "@/components/site/FounderNote";
import { FAQ } from "@/components/site/FAQ";
import { Waitlist } from "@/components/site/Waitlist";
import { Footer } from "@/components/site/Footer";

export default function HomePage() {
  return (
    <main>
      <Header />
      <Hero />
      <Problem />
      <Solution />
      <ProductPreview />
      <Compatibility />
      <Pricing />
      <FounderNote />
      <FAQ />
      <Waitlist />
      <Footer />
    </main>
  );
}
