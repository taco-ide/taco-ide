"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useRouter } from "next/navigation";

import { ArrowLeft, ArrowRight } from "lucide-react";
  

const ClassesDatabase = [
    {
        id: 1,
        name: "CS-201",
        description: "Advanced Algorithms",
        instructor: "Prof. Dr. John Doe",
    },
    {
        id: 2,
        name: "CS-305",
        description: "Computational Theory",
        instructor: "Prof. Dr. Jane Smith",
    },
    {
        id: 3,
        name: "CS-410",
        description: "Graphics and Visualization",
        instructor: "Prof. Dr. Alan Turing",
    },
    {
        id: 4,
        name: "CS-220",
        description: "System Programming",
        instructor: "Prof. Dr. Ada Lovelace",
    },
    {
        id: 5,
        name: "CS-330",
        description: "Machine Learning",
        instructor: "Prof. Dr. Marvin Minsky",
    },
    {
        id: 6,
        name: "CS-250",
        description: "Network Protocols",
        instructor: "Prof. Dr. Vint Cerf",
    },
    {
        id: 7,
        name: "CS-360",
        description: "Database Management",
        instructor: "Prof. Dr. Edgar Codd",
    },
    {
        id: 8,
        name: "CS-470",
        description: "Software Design",
        instructor: "Prof. Dr. Fred Brooks",
    },
    {
        id: 9,
        name: "CS-290",
        description: "Cybersecurity",
        instructor: "Prof. Dr. Bruce Schneier",
    },
    {
        id: 10,
        name: "CS-380",
        description: "Mobile App Development",
        instructor: "Prof. Dr. Mark Weiser",
    },
];

const lastProblems = [
    {
        id: 9,
        title: "Quick Sort",
        description: "Implement the quick sort algorithm.",
        difficulty: "Medium",
        tags: ["Sorting", "Algorithms"],
        author: "Author I",
    },
    {
        id: 10,
        title: "Depth-First Search",
        description: "Implement depth-first search in a graph.",
        difficulty: "Medium",
        tags: ["Graphs", "Search"],
        author: "Author J",
    },
    {
        id: 11,
        title: "Shortest Path Problem",
        description: "Find the shortest path between two vertices in a graph.",
        difficulty: "Hard",
        tags: ["Graphs", "Optimization"],
        author: "Author K",
    },
];

const ProblemsDatabase = [
    {
        id: 1,
        title: "Sorting Problem",
        description: "Solve the sorting problem using the algorithm of your choice.",
        difficulty: "Easy",
        tags: ["Sorting", "Algorithms"],
        author: "Author A",
    },
    {
        id: 2,
        title: "Binary Search",
        description: "Implement binary search in a sorted array.",
        difficulty: "Medium",
        tags: ["Search", "Algorithms"],
        author: "Author B",
    },
    {
        id: 3,
        title: "Traveling Salesman Problem",
        description: "Find the shortest path that visits all cities.",
        difficulty: "Hard",
        tags: ["Graphs", "Optimization"],
        author: "Author C",
    },
    {
        id: 4,
        title: "Complexity Analysis",
        description: "Determine the time and space complexity of a given algorithm.",
        difficulty: "Medium",
        tags: ["Complexity", "Theory of Computation"],
        author: "Author D",
    },
    {
        id: 5,
        title: "Longest Common Subsequence Problem",
        description: "Find the longest common subsequence between two strings.",
        difficulty: "Hard",
        tags: ["Dynamic Programming", "Strings"],
        author: "Author E",
    },
    {
        id: 6,
        title: "Counting Sort",
        description: "Implement the counting sort algorithm.",
        difficulty: "Easy",
        tags: ["Sorting", "Algorithms"],
        author: "Author F",
    },
    {
        id: 7,
        title: "Breadth-First Search",
        description: "Implement breadth-first search in a graph.",
        difficulty: "Medium",
        tags: ["Graphs", "Search"],
        author: "Author G",
    },
    {
        id: 8,
        title: "Knapsack Problem",
        description: "Solve the knapsack problem using dynamic programming.",
        difficulty: "Hard",
        tags: ["Dynamic Programming", "Optimization"],
        author: "Author H",
    },
    {
        id: 9,
        title: "Quick Sort",
        description: "Implement the quick sort algorithm.",
        difficulty: "Medium",
        tags: ["Sorting", "Algorithms"],
        author: "Author I",
    },
    {
        id: 10,
        title: "Depth-First Search",
        description: "Implement depth-first search in a graph.",
        difficulty: "Medium",
        tags: ["Graphs", "Search"],
        author: "Author J",
    },
    {
        id: 11,
        title: "Shortest Path Problem",
        description: "Find the shortest path between two vertices in a graph.",
        difficulty: "Hard",
        tags: ["Graphs", "Optimization"],
        author: "Author K",
    },
    {
        id: 12,
        title: "Insertion Sort",
        description: "Implement the insertion sort algorithm.",
        difficulty: "Easy",
        tags: ["Sorting", "Algorithms"],
        author: "Author L",
    },
    {
        id: 13,
        title: "Graph Coloring Problem",
        description: "Determine the minimum coloring of a graph.",
        difficulty: "Hard",
        tags: ["Graphs", "Optimization"],
        author: "Author M",
    },
    {
        id: 14,
        title: "Exponential Search",
        description: "Implement exponential search in a sorted array.",
        difficulty: "Medium",
        tags: ["Search", "Algorithms"],
        author: "Author N",
    },
    {
        id: 15,
        title: "Hamiltonian Path Problem",
        description: "Determine if there exists a Hamiltonian path in a graph.",
        difficulty: "Hard",
        tags: ["Graphs", "Theory of Computation"],
        author: "Author O",
    }
];

const problemsPerPage = 10;
const problemsTotal = ProblemsDatabase.length;
const pagesTotal = Math.ceil(problemsTotal / problemsPerPage);

export default function ExplorePage() {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);

    // Calcula o índice inicial e final dos problemas para a página atual
    const indexOfLastProblem = currentPage * problemsPerPage;
    const indexOfFirstProblem = indexOfLastProblem - problemsPerPage;
    const currentProblems = ProblemsDatabase.slice(indexOfFirstProblem, indexOfLastProblem);

    const handleProblemClick = (id: number) => {
        router.push(`/problem/${id}`);
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty.toLowerCase()) {
            case 'easy':
                return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'medium':
                return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'hard':
                return 'bg-red-500/10 text-red-500 border-red-500/20';
            default:
                return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 bg-slate-900">
            {lastProblems.length > 0 && (
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                            Last Problems
                        </h1>
                    </div>

                    <Carousel
                        opts={{
                            align: "start",
                        }}
                        className="w-full"
                    >
                        <CarouselContent>
                            {lastProblems.map((problem) => (
                                <CarouselItem key={problem.id} className="md:basis-1/2 lg:basis-1/4">
                                    <Card onClick={() => handleProblemClick(problem.id)} className="p-4 h-full bg-slate-800 border-slate-700 hover:border-yellow-500/50 transition-all duration-300 cursor-pointer">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-start justify-between">
                                                <h3 className="font-semibold text-lg text-white">{problem.title}</h3>
                                                <Badge variant="outline" className={`${getDifficultyColor(problem.difficulty)}`}>
                                                    {problem.difficulty}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-slate-400">{problem.description}</p>
                                            <div className="flex flex-wrap gap-2 mt-auto">
                                                {problem.tags.map((tag) => (
                                                    <Badge key={tag} variant="secondary" className="bg-slate-700 hover:bg-slate-600">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700">
                                                <span className="text-xs text-slate-400">by {problem.author}</span>
                                            </div>
                                        </div>
                                    </Card>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                    </Carousel>
                </section>
            )}

            <section className="mt-16 space-y-6">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                    Featured Classes
                </h1>
                <Carousel opts={{ align: "start" }} className="w-full">
                    <CarouselContent>
                        {ClassesDatabase.map((course) => (
                            <CarouselItem key={course.id} className="md:basis-1/2 lg:basis-1/4">
                                <Card className="p-4 h-full bg-slate-800 border-slate-700 hover:border-yellow-500/50 transition-all duration-300 cursor-pointer">
                                    <div className="flex flex-col gap-3">
                                        <h3 className="font-semibold text-lg text-white">{course.name}</h3>
                                        <p className="text-sm text-slate-400">{course.description}</p>
                                        <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-700">
                                            <span className="text-xs text-slate-400">{course.instructor}</span>
                                        </div>
                                    </div>
                                </Card>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="bg-slate-800 hover:bg-slate-700 border-slate-700" />
                    <CarouselNext className="bg-slate-800 hover:bg-slate-700 border-slate-700" />
                </Carousel>
            </section>

            <section className="mt-16 space-y-6">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                    Problems
                </h1>

                <div className="rounded-lg border border-slate-700 bg-slate-800/50">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-slate-800/80 border-slate-700">
                                <TableHead className="text-slate-200 font-semibold">Title</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Description</TableHead>
                                <TableHead className="text-slate-200 font-semibold w-32">Difficulty</TableHead>
                                <TableHead className="text-slate-200 font-semibold">Tags</TableHead>
                                <TableHead className="text-slate-200 font-semibold text-right">Author</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentProblems.map((problem) => (
                                <TableRow
                                    key={problem.id}
                                    onClick={() => handleProblemClick(problem.id)}
                                    className="hover:bg-slate-800/80 border-slate-700 cursor-pointer"
                                >
                                    <TableCell className="font-medium text-white">
                                        {problem.title}
                                    </TableCell>
                                    <TableCell className="text-slate-300">
                                        {problem.description.length > 30 ? problem.description.substring(0, 30) + '...' : problem.description}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={`${getDifficultyColor(problem.difficulty)}`}
                                        >
                                            {problem.difficulty}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {problem.tags.map((tag) => (
                                                <Badge
                                                    key={tag}
                                                    variant="secondary"
                                                    className="bg-slate-700 hover:bg-slate-600 text-xs"
                                                >
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-slate-300">
                                        {problem.author}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}

                <div className="mt-4 flex justify-center items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-1 rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                        <ArrowLeft />
                    </button>
                    
                    {Array.from({ length: pagesTotal }, (_, i) => i + 1).map((page) => (
                        <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 rounded ${currentPage === page ? 'bg-yellow-500/20 text-yellow-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                        >
                            {page}
                        </button>
                    ))}

                    <button
                        onClick={() => setCurrentPage(p => Math.min(pagesTotal, p + 1))}
                        disabled={currentPage === pagesTotal}
                        className={`px-3 py-1 rounded ${currentPage === pagesTotal ? 'opacity-50 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                        <ArrowRight />
                    </button>
                </div>

            </section>
        </div>
    );
}