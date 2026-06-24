import { Link } from "wouter";
import { Plus, Pencil, Trash2, Bot, Rocket, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useGetAssistants,
  useDeleteAssistant,
  usePublishAssistant,
  useUnpublishAssistant,
} from "@/lib/api";

const LANGUAGE_LABELS: Record<string, string> = {
  english: "English",
  hindi: "Hindi",
  bengali: "Bengali",
  telugu: "Telugu",
  gujarati: "Gujarati",
};

function StatusBadge({ status }: { status: "development" | "production" }) {
  return status === "production" ? (
    <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
      Production
    </Badge>
  ) : (
    <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
      Development
    </Badge>
  );
}

export default function AssistantsPage() {
  const queryClient = useQueryClient();
  const { data: assistants = [], isLoading } = useGetAssistants();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["assistants"] });

  const deleteAssistant = useDeleteAssistant({
    mutation: {
      onSuccess: () => { invalidate(); toast.success("Assistant deleted"); },
      onError: (e: any) => toast.error(e?.data?.detail ?? "Failed to delete assistant"),
    },
  });

  const publish = usePublishAssistant({
    mutation: {
      onSuccess: (a) => { invalidate(); toast.success(`"${a.name}" is now live in production`); },
      onError: () => toast.error("Failed to publish"),
    },
  });

  const unpublish = useUnpublishAssistant({
    mutation: {
      onSuccess: (a) => { invalidate(); toast.success(`"${a.name}" moved back to development`); },
      onError: () => toast.error("Failed to move to development"),
    },
  });

  return (
    <AdminLayout title="Assistants">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {assistants.length} assistant{assistants.length !== 1 ? "s" : ""}
          </p>
          <Link href="/assistants/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Assistant
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading…</div>
        ) : assistants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <Bot className="h-10 w-10 opacity-30" />
            <p className="text-sm">No assistants yet. Create your first one.</p>
            <Link href="/assistants/new">
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />New Assistant
              </Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Voice</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Temp</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead className="text-right w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assistants.map((a) => {
                  const isProduction = a.status === "production";
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {LANGUAGE_LABELS[a.default_language] ?? a.default_language}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.voice}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{a.llm_model}</TableCell>
                      <TableCell className="text-muted-foreground">{a.temperature}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {a.business_hours_start} – {a.business_hours_end}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">

                          {/* Publish / Unpublish */}
                          {isProduction ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-600 hover:text-amber-700"
                                  onClick={() => unpublish.mutate(a.id)}
                                  disabled={unpublish.isPending}
                                >
                                  <ArrowDownToLine className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Move to Development</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600 hover:text-green-700"
                                  onClick={() => publish.mutate(a.id)}
                                  disabled={publish.isPending}
                                >
                                  <Rocket className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Publish to Production</TooltipContent>
                            </Tooltip>
                          )}

                          {/* Edit — disabled in production */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Link href={`/assistants/${a.id}`}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={isProduction}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isProduction ? "Move to Development to edit" : "Edit"}
                            </TooltipContent>
                          </Tooltip>

                          {/* Delete — disabled in production */}
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      disabled={isProduction}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isProduction ? "Move to Development to delete" : "Delete"}
                              </TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{a.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the assistant and unlink any assigned phone numbers.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteAssistant.mutate(a.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
