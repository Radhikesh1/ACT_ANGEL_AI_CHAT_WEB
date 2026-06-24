import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Lock, ArrowDownToLine, Rocket } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetAssistant,
  useCreateAssistant,
  useUpdateAssistant,
  usePublishAssistant,
  useUnpublishAssistant,
} from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "bengali", label: "Bengali" },
  { value: "telugu", label: "Telugu" },
  { value: "gujarati", label: "Gujarati" },
];

const VOICES: Record<string, { value: string; label: string }[]> = {
  english: [{ value: "pooja", label: "Pooja" }],
  hindi: [{ value: "priya", label: "Priya" }],
  bengali: [{ value: "simran", label: "Simran" }],
  telugu: [{ value: "kavitha", label: "Kavitha" }],
  gujarati: [{ value: "priya", label: "Priya" }],
};

const ALL_VOICES = [
  { value: "pooja", label: "Pooja (English)" },
  { value: "priya", label: "Priya (Hindi / Gujarati)" },
  { value: "simran", label: "Simran (Bengali)" },
  { value: "kavitha", label: "Kavitha (Telugu)" },
];

const MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o mini (fast, cost-efficient)" },
  { value: "gpt-4o", label: "GPT-4o (most capable)" },
];

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  system_prompt: z.string().min(10, "System prompt must be at least 10 characters"),
  welcome_message: z.string().min(1, "Welcome message is required"),
  default_language: z.string(),
  voice: z.string(),
  llm_model: z.string(),
  temperature: z.coerce.number().min(0).max(1),
  business_hours_start: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  business_hours_end: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  name: "",
  system_prompt: "",
  welcome_message: "Hello. I am Ciya. How can I help you?",
  default_language: "english",
  voice: "pooja",
  llm_model: "gpt-4o-mini",
  temperature: 0.2,
  business_hours_start: "10:30",
  business_hours_end: "18:30",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssistantFormPage() {
  const params = useParams<{ id?: string }>();
  const id = params.id === "new" ? undefined : params.id;
  const isEdit = !!id;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: existing, isLoading } = useGetAssistant(id);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        system_prompt: existing.system_prompt,
        welcome_message: existing.welcome_message,
        default_language: existing.default_language,
        voice: existing.voice,
        llm_model: existing.llm_model,
        temperature: existing.temperature,
        business_hours_start: existing.business_hours_start,
        business_hours_end: existing.business_hours_end,
      });
    }
  }, [existing, reset]);

  const temperature = watch("temperature");
  const selectedLanguage = watch("default_language");
  const isProduction = isEdit && existing?.status === "production";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["assistants"] });

  const create = useCreateAssistant({
    mutation: {
      onSuccess: () => { invalidate(); toast.success("Assistant created"); navigate("/assistants"); },
      onError: () => toast.error("Failed to create assistant"),
    },
  });

  const update = useUpdateAssistant({
    mutation: {
      onSuccess: () => { invalidate(); toast.success("Assistant saved"); navigate("/assistants"); },
      onError: (e: any) => toast.error(e?.data?.detail ?? "Failed to save assistant"),
    },
  });

  const publish = usePublishAssistant({
    mutation: {
      onSuccess: (a) => { invalidate(); toast.success(`"${a.name}" is now live in production`); navigate("/assistants"); },
      onError: () => toast.error("Failed to publish"),
    },
  });

  const unpublish = useUnpublishAssistant({
    mutation: {
      onSuccess: (a) => { invalidate(); toast.success(`"${a.name}" moved to development`); },
      onError: () => toast.error("Failed to move to development"),
    },
  });

  const onSubmit = (values: FormValues) => {
    if (isEdit) {
      update.mutate({ id: id!, data: values });
    } else {
      create.mutate(values);
    }
  };

  if (isEdit && isLoading) {
    return (
      <AdminLayout title={isEdit ? "Edit Assistant" : "New Assistant"}>
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Loading…
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={isEdit ? `Edit: ${existing?.name ?? "…"}` : "New Assistant"}>
      <div className="max-w-2xl space-y-6">
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => navigate("/assistants")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Assistants
        </Button>

        {/* Production lock banner */}
        {isProduction && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Lock className="h-4 w-4 flex-shrink-0" />
              <p className="text-sm font-medium">
                This assistant is in production — all fields are locked.
                Move it to Development to make changes.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-4 shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400"
              onClick={() => unpublish.mutate(id!)}
              disabled={unpublish.isPending}
            >
              <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
              Move to Development
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Assistant Name</Label>
            <Input id="name" placeholder="e.g. Ciya – Citadel Sales" disabled={isProduction} {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Welcome message */}
          <div className="space-y-1.5">
            <Label htmlFor="welcome_message">Welcome Message</Label>
            <Input
              id="welcome_message"
              placeholder="Hello. I am Ciya. How can I help you?"
              disabled={isProduction}
              {...register("welcome_message")}
            />
            {errors.welcome_message && (
              <p className="text-xs text-destructive">{errors.welcome_message.message}</p>
            )}
          </div>

          {/* System Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="system_prompt">System Prompt</Label>
            <Textarea
              id="system_prompt"
              rows={10}
              placeholder="You are Ciya, a warm and professional AI assistant for Citadel…"
              className="font-mono text-xs resize-y"
              disabled={isProduction}
              {...register("system_prompt")}
            />
            {errors.system_prompt && (
              <p className="text-xs text-destructive">{errors.system_prompt.message}</p>
            )}
          </div>

          {/* Language + Voice */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Default Language</Label>
              <Select
                value={selectedLanguage}
                disabled={isProduction}
                onValueChange={(v) => {
                  setValue("default_language", v);
                  const voices = VOICES[v];
                  if (voices?.length) setValue("voice", voices[0].value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Voice</Label>
              <Select
                value={watch("voice")}
                disabled={isProduction}
                onValueChange={(v) => setValue("voice", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_VOICES.map((v) => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* LLM Model */}
          <div className="space-y-1.5">
            <Label>LLM Model</Label>
            <Select
              value={watch("llm_model")}
              disabled={isProduction}
              onValueChange={(v) => setValue("llm_model", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Temperature */}
          <div className="space-y-1.5">
            <Label htmlFor="temperature">
              Temperature
              <span className="ml-2 text-muted-foreground font-normal">
                {temperature} — {temperature <= 0.3 ? "precise" : temperature <= 0.6 ? "balanced" : "creative"}
              </span>
            </Label>
            <input
              id="temperature"
              type="range"
              min={0}
              max={1}
              step={0.05}
              disabled={isProduction}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
              {...register("temperature")}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0 – Precise</span>
              <span>1 – Creative</span>
            </div>
          </div>

          {/* Business Hours */}
          <div className="space-y-1.5">
            <Label>Business Hours (Mon – Fri)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="time"
                className="w-32"
                disabled={isProduction}
                {...register("business_hours_start")}
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="time"
                className="w-32"
                disabled={isProduction}
                {...register("business_hours_end")}
              />
            </div>
            {(errors.business_hours_start || errors.business_hours_end) && (
              <p className="text-xs text-destructive">Use HH:MM format</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            {!isProduction && (
              <Button type="submit" disabled={isSubmitting || create.isPending || update.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {isEdit ? "Save Changes" : "Create Assistant"}
              </Button>
            )}

            {isEdit && !isProduction && (
              <Button
                type="button"
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
                onClick={() => publish.mutate(id!)}
                disabled={publish.isPending}
              >
                <Rocket className="h-4 w-4 mr-2" />
                Publish to Production
              </Button>
            )}

            <Button type="button" variant="outline" onClick={() => navigate("/assistants")}>
              {isProduction ? "Back" : "Cancel"}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
