import { FC } from "react";
import React from "react";

interface FeatureCard {
  title: string;
  icon: React.ReactNode;
  items: string[];
}

interface FeatureSectionProps {
  title: string;
  description: string;
  features: FeatureCard[];
  accentColor: string;
  position?: "left" | "right";
}

const FeatureSection: FC<FeatureSectionProps> = ({
  title,
  description,
  accentColor,
  position = "right",
}) => (
  <div className="text-center mb-24 relative">
    <h2 className="text-4xl font-bold mb-6 inline-block">
      <span
        className={`bg-gradient-to-r from-[${accentColor}] to-[#FFA000] text-transparent bg-clip-text`}
      >
        {title}
      </span>
    </h2>
    <p className="text-xl text-gray-300 max-w-2xl mx-auto">{description}</p>
    <div
      className={`absolute -top-10 -${position}-10 w-40 h-40 bg-[${accentColor}] rounded-full filter blur-[100px] opacity-20`}
    ></div>
  </div>
);

const Features = () => {
  const professorFeatures: FeatureCard[] = [
    {
      title: "Exercise Management",
      icon: (
        <svg
          className="w-8 h-8 text-[#4CAF50]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
      items: [
        "Create custom exercises",
        "Define allowed libraries",
        "Share publicly or privately",
        "Post commented answers",
      ],
    },
    {
      title: "Class Management",
      icon: (
        <svg
          className="w-8 h-8 text-[#4CAF50]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
      items: [
        "Create and manage classes",
        "Track individual progress",
        "AI-automated grading",
        "Performance dashboard",
      ],
    },
    {
      title: "Data Analysis",
      icon: (
        <svg
          className="w-8 h-8 text-[#4CAF50]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
      items: [
        "Difficulties by category",
        "Class progress",
        "Personalized insights",
        "More assertive content",
      ],
    },
  ];

  const studentFeatures: FeatureCard[] = [
    {
      title: "Smart IDE",
      icon: (
        <svg
          className="w-8 h-8 text-[#FFB800]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
      ),
      items: [
        "Real-time feedback",
        "Personalized AI support",
        "Contextualized tips",
        "Safe environment",
      ],
    },
    {
      title: "Adaptive Learning",
      icon: (
        <svg
          className="w-8 h-8 text-[#FFB800]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      ),
      items: [
        "Community exercises",
        "Personalized progress",
        "Learn at your own pace",
        "Intelligent assistance",
      ],
    },
    {
      title: "AI Resources",
      icon: (
        <svg
          className="w-8 h-8 text-[#FFB800]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
      items: [
        "LLM trained for Python",
        "Contextualized help",
        "No ready-made answers",
        "Focus on learning",
      ],
    },
  ];

  const renderFeatureCards = (features: FeatureCard[], accentColor: string) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {features.map((feature, index) => (
        <div
          key={index}
          className={`group relative bg-gradient-to-b from-[#2a2f3e] to-[#252a38] p-8 rounded-2xl hover:transform hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-[${accentColor}]/10`}
        >
          <div
            className={`absolute inset-0 bg-gradient-to-r from-[${accentColor}]/10 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300`}
          ></div>
          <div className="relative">
            <div className="flex items-center gap-4 mb-6">
              {feature.icon}
              <h3 className="text-xl font-bold text-white">{feature.title}</h3>
            </div>
            <ul className="space-y-3">
              {feature.items.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className="flex items-center gap-2 text-gray-300 group-hover:text-white transition-colors"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full bg-[${accentColor}]`}
                  ></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <section className="container mx-auto px-4 pt-16 pb-32" id="features">
      <FeatureSection
        title="For Teachers"
        description="Powerful tools to create, manage, and evaluate exercises"
        features={professorFeatures}
        accentColor="#4CAF50"
        position="right"
      />
      <div className="mb-32">
        {renderFeatureCards(professorFeatures, "#4CAF50")}
      </div>

      <FeatureSection
        title="For Students"
        description="Interactive environment with AI support for more efficient learning"
        features={studentFeatures}
        accentColor="#FFB800"
        position="left"
      />
      {renderFeatureCards(studentFeatures, "#FFB800")}
    </section>
  );
};

export default Features;
