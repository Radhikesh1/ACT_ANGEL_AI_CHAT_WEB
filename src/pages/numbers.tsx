import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle2,
  XCircle,
  Unlink,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
  useLookupNumber,
  useAssignNumber,
  useUnassignNumber,
  useDeleteNumber,
  useGetPlivoSettings,
  useUpdatePlivoSettings,
  type PlivoSettingsInput,
} from "@/lib/api";

// ── Add Number Dialog ─────────────────────────────────────────────────────────

const addSchema = z.object({
  number:           z.string().min(1, "Phone number is required"),
  plivo_auth_id:    z.string().min(1, "Auth ID is required"),
  plivo_auth_token: z.string().optional(),
  domain:           z.string().min(1, "Domain is required"),
});
type AddValues = z.infer<typeof addSchema>;

function AddNumberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: settings } = useGetPlivoSettings();
  const [showToken, setShowToken] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddValues>({
    resolver: zodResolver(addSchema),
    values: settings
      ? {
          number:           "",
          plivo_auth_id:    settings.plivo_auth_id,
          plivo_auth_token: "",
          domain:           settings.domain,
        }
      : undefined,
  });

  const updateCreds = useUpdatePlivoSettings();

  const lookup = useLookupNumber({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["numbers"] });
        toast.success(`${data.number} added successfully`);
        reset();
        onOpenChange(false);
      },
      onError: (e: any) =>
        toast.error(e?.data?.detail ?? "Number not found in your Plivo account"),
    },
  });

  const onSubmit = async (values: AddValues) => {
    // Save credentials first, then look up the number
    const payload: PlivoSettingsInput = {
      plivo_auth_id: values.plivo_auth_id,
      domain:        values.domain,
    };
    if (values.plivo_auth_token) {
      payload.plivo_auth_token = values.plivo_auth_token;
    }
    await updateCreds.mutateAsync(payload);
    queryClient.invalidateQueries({ queryKey: ["plivo-settings"] });
    lookup.mutate(values.number.trim());
  };

  const isPending = updateCreds.isPending || lookup.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Phone Number</DialogTitle>
          <DialogDescription>
            Enter your Plivo credentials and the number to add.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Auth ID */}
          <div className="space-y-1.5">
            <Label htmlFor="d-auth-id">Plivo Auth ID</Label>
            <Input
              id="d-auth-id"
              placeholder="MAMTY0ZJI3YTC5ZDMNXX"
              className="font-mono"
              {...register("plivo_auth_id")}
            />
            {errors.plivo_auth_id && (
              <p className="text-xs text-destructive">{errors.plivo_auth_id.message}</p>
            )}
          </div>

          {/* Auth Token */}
          <div className="space-y-1.5">
            <Label htmlFor="d-auth-token">Auth Token</Label>
            <div className="relative">
              <Input
                id="d-auth-token"
                type={showToken ? "text" : "password"}
                placeholder={
                  settings?.plivo_auth_token
                    ? settings.plivo_auth_token
                    : "Enter auth token"
                }
                className="font-mono pr-10"
                {...register("plivo_auth_token")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowToken((s) => !s)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave blank to keep the existing token.
            </p>
          </div>

          {/* Domain */}
          <div className="space-y-1.5">
            <Label htmlFor="d-domain">Domain / Webhook Host</Label>
            <Input
              id="d-domain"
              placeholder="your-tunnel.trycloudflare.com"
              {...register("domain")}
            />
            <p className="text-xs text-muted-foreground">
              Used to build the answer webhook URL.
            </p>
            {errors.domain && (
              <p className="text-xs text-destructive">{errors.domain.message}</p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t pt-2" />

          {/* Phone number */}
          <div className="space-y-1.5">
            <Label htmlFor="d-number">Phone number</Label>
            <Input
              id="d-number"
              placeholder="+918035453556"
              className="font-mono"
              autoFocus
              {...register("number")}
            />
            <p className="text-xs text-muted-foreground">
              E.164 format — the + prefix is optional.
            </p>
            {errors.number && (
              <p className="text-xs text-destructive">{errors.number.message}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => reset()}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add Number"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NumbersPage() {
  const queryClient = useQueryClient();
  const { data: numbers = [], isLoading } = useGetNumbers();
  const { data: assistants = [] } = useGetAssistants();
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["numbers"] });

  const assign = useAssignNumber({
    mutation: {
      onSuccess: (_, vars) => {
        invalidate();
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
        invalidate();
        toast.success(`Unassigned ${number}`);
        setPending(null);
      },
      onError: (_, number) => {
        toast.error(`Failed to unassign ${number}`);
        setPending(null);
      },
    },
  });

  const del = useDeleteNumber({
    mutation: {
      onSuccess: (_, number) => {
        invalidate();
        toast.success(`Removed ${number}`);
        setPending(null);
      },
      onError: (_, number) => {
        toast.error(`Failed to remove ${number}`);
        setPending(null);
      },
    },
  });

  const handleAssign = (number: string, assistantId: string) => {
    setPending(number);
    if (!assistantId || assistantId === "__unassign__") {
      unassign.mutate(number);
    } else {
      assign.mutate({ number, assistantId });
    }
  };

  return (
    <AdminLayout title="Phone Numbers">
      <div className="space-y-4">
        <AddNumberDialog open={addOpen} onOpenChange={setAddOpen} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {numbers.length} number{numbers.length !== 1 ? "s" : ""}
          </p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Number
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Loading…
          </div>
        ) : numbers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <Phone className="h-10 w-10 opacity-30" />
            <p className="text-sm">No numbers yet. Add your first one.</p>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Number
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Alias</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Webhook</TableHead>
                  <TableHead>Assigned Assistant</TableHead>
                  <TableHead className="text-right w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.map((n) => {
                  const isBusy = pending === n.number;
                  return (
                    <TableRow key={n.number}>
                      <TableCell className="font-mono font-medium text-sm">
                        {n.number}
                      </TableCell>
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
                            <CheckCircle2 className="h-3.5 w-3.5" /> Set
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <XCircle className="h-3.5 w-3.5" /> Not set
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          disabled={isBusy}
                          value={n.assistant_id ?? "__unassign__"}
                          onValueChange={(v) => handleAssign(n.number, v)}
                        >
                          <SelectTrigger className="h-8 w-44 text-xs">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              value="__unassign__"
                              className="text-muted-foreground"
                            >
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {n.assistant_id && (
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
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={isBusy}
                            onClick={() => {
                              setPending(n.number);
                              del.mutate(n.number);
                            }}
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {numbers.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Assigning a number automatically updates the Plivo webhook to point at this server.
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
