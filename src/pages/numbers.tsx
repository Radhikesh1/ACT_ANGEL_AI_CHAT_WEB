import { useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, LinkIcon, Unlink } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetNumbers,
  useGetAssistants,
  useAssignNumber,
  useUnassignNumber,
} from "@/lib/api";

export default function NumbersPage() {
  const queryClient = useQueryClient();
  const { data: numbers = [], isLoading, refetch, isFetching } = useGetNumbers();
  const { data: assistants = [] } = useGetAssistants();

  // Track which number is being modified
  const [pending, setPending] = useState<string | null>(null);

  const assign = useAssignNumber({
    mutation: {
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: ["numbers"] });
        toast.success(`Assigned ${vars.number} and configured webhook`);
        setPending(null);
      },
      onError: (_, vars) => {
        toast.error(`Failed to assign ${vars.number}`);
        setPending(null);
      },
    },
  });

  const unassign = useUnassignNumber({
    mutation: {
      onSuccess: (_, number) => {
        queryClient.invalidateQueries({ queryKey: ["numbers"] });
        toast.success(`Unassigned ${number}`);
        setPending(null);
      },
      onError: (_, number) => {
        toast.error(`Failed to unassign ${number}`);
        setPending(null);
      },
    },
  });

  const handleAssign = (number: string, assistantId: string) => {
    if (!assistantId || assistantId === "__unassign__") {
      setPending(number);
      unassign.mutate(number);
    } else {
      setPending(number);
      assign.mutate({ number, assistantId });
    }
  };

  return (
    <AdminLayout title="Phone Numbers">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {numbers.length} number{numbers.length !== 1 ? "s" : ""} in your Plivo account
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Loading…
          </div>
        ) : numbers.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No numbers found in your Plivo account.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Name / Alias</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Webhook</TableHead>
                  <TableHead>Assigned Assistant</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.map((n) => {
                  const isBusy = pending === n.number;
                  return (
                    <TableRow key={n.number}>
                      <TableCell className="font-mono text-sm">{n.number}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {n.friendly_name || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {n.country || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {n.number_type || "local"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {n.webhook_configured ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Set
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <XCircle className="h-3.5 w-3.5" />
                            Not set
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          disabled={isBusy}
                          value={n.assistant_id ?? "__unassign__"}
                          onValueChange={(v) => handleAssign(n.number, v)}
                        >
                          <SelectTrigger className="h-8 w-48 text-xs">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__unassign__" className="text-muted-foreground">
                              — Unassigned —
                            </SelectItem>
                            {assistants.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {n.assistant_id ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            disabled={isBusy}
                            onClick={() => {
                              setPending(n.number);
                              unassign.mutate(n.number);
                            }}
                            title="Unassign"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <div className="h-8 w-8" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Assigning a number automatically updates the Plivo webhook to point at this server.
        </p>
      </div>
    </AdminLayout>
  );
}
