"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Pencil, Trash2 } from "lucide-react";
import { useGetV1Challenges, useDeleteV1ChallengesId, getV1ChallengesQueryKey } from "@/kubb/hooks";
import { PermissionGuard } from "@/components/guards/PermissionGuard";

// TODO: Replace mock data with real data from GET /v1/classrooms endpoint when available
const ClassesDatabase = [
  { id: 1, name: "CS-201", description: "Advanced Algorithms", instructor: "Prof. Dr. John Doe" },
  { id: 2, name: "CS-305", description: "Computational Theory", instructor: "Prof. Dr. Jane Smith" },
];

const problemsPerPage = 10;

export default function ExplorePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data,
    isLoading,
    error,
  } = useGetV1Challenges(
    {
      scope: "all",
      page: currentPage,
      perPage: problemsPerPage,
    },
    {}
  );

  const deleteMutation = useDeleteV1ChallengesId({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getV1ChallengesQueryKey() });
      },
    },
  });

  const challenges = data?.data ?? [];
  const pagination = data?.pagination ?? {
    total: 0,
    page: 1,
    perPage: problemsPerPage,
    totalPages: 0,
  };
  const pagesTotal = pagination.totalPages || 1;

  const handleProblemClick = (id: string) => {
    router.push(`/problem/${id}`);
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    router.push(`/create/${id}`);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case "easy":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "hard":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const lastProblems = challenges.slice(0, 4);

  return (
    <div className="container mx-auto px-4 py-8 bg-slate-900">
      {isLoading && challenges.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-yellow-500" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error instanceof Error ? error.message : "Erro ao carregar problemas"}
        </div>
      ) : (
        <>
          {lastProblems.length > 0 && (
            <section className="space-y-6">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                Ultimos Problemas
              </h1>
              <Carousel opts={{ align: "start" }} className="w-full">
                <CarouselContent>
                  {lastProblems.map((problem) => (
                    <CarouselItem key={problem.id} className="md:basis-1/2 lg:basis-1/4">
                      <Card
                        onClick={() => handleProblemClick(problem.id)}
                        className="p-4 h-full bg-slate-800 border-slate-700 hover:border-yellow-500/50 transition-all duration-300 cursor-pointer"
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold text-lg text-white">{problem.title}</h3>
                            <Badge
                              variant="outline"
                              className={getDifficultyColor(problem.difficulty ?? "")}
                            >
                              {problem.difficulty ?? "-"}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-400">
                            {problem.description ?? ""}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-auto">
                            {(problem.tags ?? []).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="bg-slate-700 hover:bg-slate-600"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          {problem.author && (
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700">
                              <span className="text-xs text-slate-400">por {problem.author}</span>
                            </div>
                          )}
                        </div>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="bg-slate-800 hover:bg-slate-700 border-slate-700" />
                <CarouselNext className="bg-slate-800 hover:bg-slate-700 border-slate-700" />
              </Carousel>
            </section>
          )}

          <section className="mt-16 space-y-6">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              Turmas em Destaque
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
              Problemas
            </h1>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-slate-800/80 border-slate-700">
                        <TableHead className="text-slate-200 font-semibold">Titulo</TableHead>
                        <TableHead className="text-slate-200 font-semibold">Descricao</TableHead>
                        <TableHead className="text-slate-200 font-semibold w-32">Dificuldade</TableHead>
                        <TableHead className="text-slate-200 font-semibold">Tags</TableHead>
                        <TableHead className="text-slate-200 font-semibold text-right">Autor</TableHead>
                        <PermissionGuard resource="challenge" action="update">
                          <TableHead className="text-slate-200 font-semibold text-center w-24">Acoes</TableHead>
                        </PermissionGuard>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {challenges.map((problem) => (
                        <TableRow
                          key={problem.id}
                          onClick={() => handleProblemClick(problem.id)}
                          className="hover:bg-slate-800/80 border-slate-700 cursor-pointer"
                        >
                          <TableCell className="font-medium text-white">
                            {problem.title}
                          </TableCell>
                          <TableCell className="text-slate-300">
                            {(problem.description ?? "").length > 30
                              ? (problem.description ?? "").substring(0, 30) + "..."
                              : problem.description ?? ""}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getDifficultyColor(problem.difficulty ?? "")}
                            >
                              {problem.difficulty ?? "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(problem.tags ?? []).map((tag) => (
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
                            {problem.author ?? "-"}
                          </TableCell>
                          <PermissionGuard resource="challenge" action="update">
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <PermissionGuard resource="challenge" action="update">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => handleEdit(e, problem.id)}
                                    className="text-slate-400 hover:text-yellow-400 hover:bg-slate-700 h-8 w-8 p-0"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                </PermissionGuard>
                                <PermissionGuard resource="challenge" action="delete">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-slate-400 hover:text-red-400 hover:bg-slate-700 h-8 w-8 p-0"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="bg-slate-800 border-slate-700">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="text-white">
                                          Excluir problema
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-slate-400">
                                          Tem certeza que deseja excluir &quot;{problem.title}&quot;? Esta acao nao pode ser desfeita.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600">
                                          Cancelar
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDelete(problem.id)}
                                          className="bg-red-600 hover:bg-red-700 text-white"
                                        >
                                          Excluir
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </PermissionGuard>
                              </div>
                            </TableCell>
                          </PermissionGuard>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex justify-center items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded ${
                      currentPage === 1 ? "opacity-50 cursor-not-allowed" : "bg-slate-700 hover:bg-slate-600"
                    }`}
                  >
                    <ArrowLeft />
                  </button>
                  {Array.from({ length: pagesTotal }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded ${
                        currentPage === page ? "bg-yellow-500/20 text-yellow-500" : "bg-slate-700 hover:bg-slate-600"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(pagesTotal, p + 1))}
                    disabled={currentPage === pagesTotal}
                    className={`px-3 py-1 rounded ${
                      currentPage === pagesTotal ? "opacity-50 cursor-not-allowed" : "bg-slate-700 hover:bg-slate-600"
                    }`}
                  >
                    <ArrowRight />
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
