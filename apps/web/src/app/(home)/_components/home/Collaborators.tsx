import Image from "next/image";
import collaboratorsData from "@/data/collaborators.json";

interface Contributor {
  login: string;
  avatar_url: string;
  html_url: string;
  name: string | null;
}

const Collaborators = () => {
  const { collaborators } = collaboratorsData;

  return (
    <section className="relative py-32 overflow-hidden" id="collaborators">
      <div className="absolute inset-0 bg-gradient-to-b from-[#2a2f3e] to-[#1a1f2e]"></div>
      <div className="absolute inset-0"></div>

      <div className="container mx-auto px-4 relative">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-8">
            <span className="bg-gradient-to-r from-[#FFB800] to-[#FFA000] text-transparent bg-clip-text">
              Our Collaborators
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {collaborators.map((contributor: Contributor) => (
            <a
              key={contributor.login}
              href={contributor.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center"
            >
              <div className="w-20 h-20 rounded-full overflow-hidden mb-2 ring-2 ring-[#FFB800]/20 group-hover:ring-[#FFB800]/40 transition-all duration-300 group-hover:scale-110">
                <Image
                  src={contributor.avatar_url}
                  alt={contributor.name || contributor.login}
                  width={80}
                  height={80}
                  className="object-cover"
                />
              </div>
              <h3 className="text-sm font-medium text-white text-center group-hover:text-[#FFB800] transition-colors">
                {contributor.name || contributor.login}
              </h3>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Collaborators;
