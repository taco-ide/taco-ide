"use client";

import Header from "@/app/(home)/_components/layout/Header";
import Footer from "@/app/(home)/_components/layout/Footer";
import Hero from "@/app/(home)/_components/home/Hero";
import Features from "@/app/(home)/_components/home/Features";
import Collaborators from "@/app/(home)/_components/home/Collaborators";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1f2e] via-[#1a1f2e] to-[#151822] text-white relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#4CAF50] rounded-full filter blur-[128px] opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-[#FFB800] rounded-full filter blur-[128px] opacity-10 animate-pulse delay-1000"></div>
      </div>

      <Header />
      <Hero />
      <Features />
      <Collaborators />
      <Footer />
    </div>
  );
}
