import Nav from "@/app/(home)/_components/landing/Nav";
import Hero from "@/app/(home)/_components/landing/Hero";
import IdeDemo from "@/app/(home)/_components/landing/IdeDemo";
import Duo from "@/app/(home)/_components/landing/Duo";
import AiFeedback from "@/app/(home)/_components/landing/AiFeedback";
import OpenSource from "@/app/(home)/_components/landing/OpenSource";
import FinalCta from "@/app/(home)/_components/landing/FinalCta";
import Footer from "@/app/(home)/_components/landing/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1F2E] via-[#1A1F2E] to-[#151822] text-white [background-attachment:fixed]">
      <Nav />
      <Hero />
      <IdeDemo />
      <Duo />
      <AiFeedback />
      <OpenSource />
      <FinalCta />
      <Footer />
    </div>
  );
}
