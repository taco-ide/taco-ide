"use client";
import { User } from "lucide-react";

function HeaderProfileBtn() {
  return (
    <>
      <button className="flex items-center gap-2 p-2 rounded-lg bg-[#1e1e2e] ring-1 ring-gray-800/50 hover:ring-gray-700/50 transition-all">
        <User className="w-5 h-5 text-gray-300" />
        <span className="text-sm font-medium text-gray-300">Profile</span>
      </button>
    </>
  );
}
export default HeaderProfileBtn;
