import { Fragment } from "react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetAssistant,
  useCreateAssistant,
  useUpdateAssistant,
  usePublishAssistant,
  useUnpublishAssistant,
  type Assistant,
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

const MODEL_GROUPS = [
  {
    label: "Cheapest",
    models: [
      {
        value: "gpt-5-nano",
        name: "GPT-5 Nano",
        inputPer1M: 0.05,
        outputPer1M: 0.4,
        note: "Ultra-fast, lowest cost",
      },
    ],
  },
  {
    label: "Best Value",
    models: [
      {
        value: "gpt-4o-mini",
        name: "GPT-4o Mini",
        inputPer1M: 0.15,
        outputPer1M: 0.6,
        note: "Fast, cost-efficient",
      },
      {
        value: "gpt-5-mini",
        name: "GPT-5 Mini",
        inputPer1M: 0.25,
        outputPer1M: 2.0,
        note: "Balanced performance",
      },
    ],
  },
  {
    label: "Premium",
    models: [
      {
        value: "gpt-5",
        name: "GPT-5",
        inputPer1M: 1.25,
        outputPer1M: 10.0,
        note: "Highest capability",
      },
      {
        value: "gpt-4o",
        name: "GPT-4o",
        inputPer1M: 2.5,
        outputPer1M: 10.0,
        note: "Most capable (current)",
      },
    ],
  },
];

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  system_prompt: z
    .string()
    .min(10, "System prompt must be at least 10 characters"),
  welcome_message: z.string().min(1, "Welcome message is required"),
  default_language: z.string(),
  voice: z.string(),
  llm_model: z.string(),
  temperature: z.coerce.number().min(0).max(1),
  business_hours_start: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  business_hours_end: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  prefetch_webhook_url: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional(),
  end_of_call_webhook_url: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional(),
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
  prefetch_webhook_url: "",
  end_of_call_webhook_url: "",
};

function fromAssistant(a: Assistant): FormValues {
  return {
    name: a.name,
    system_prompt: a.system_prompt,
    welcome_message: a.welcome_message,
    default_language: a.default_language,
    voice: a.voice,
    llm_model: a.llm_model,
    temperature: a.temperature,
    business_hours_start: a.business_hours_start,
    business_hours_end: a.business_hours_end,
    prefetch_webhook_url: a.prefetch_webhook_url ?? "",
    end_of_call_webhook_url: a.end_of_call_webhook_url ?? "",
  };
}

// ── Page (handles loading) ────────────────────────────────────────────────────

export default function AssistantFormPage() {
  const params = useParams<{ id?: string }>();
  const id = params.id === "new" ? undefined : params.id;
  const isEdit = !!id;

  const { data: existing, isLoading } = useGetAssistant(id);

  if (isEdit && isLoading) {
    return (
      <AdminLayout title="Edit Assistant">
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Loading…
        </div>
      </AdminLayout>
    );
  }

  return (
    <AssistantForm
      key={existing?.id ?? "new"}
      id={id}
      isEdit={isEdit}
      existing={existing}
    />
  );
}

// ── Form (mounts only once data is ready) ────────────────────────────────────

function AssistantForm({
  id,
  isEdit,
  existing,
}: {
  id: string | undefined;
  isEdit: boolean;
  existing: Assistant | undefined;
}) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: existing ? fromAssistant(existing) : DEFAULTS,
  });

  const temperature = watch("temperature");
  const selectedLanguage = watch("default_language");
  const isProduction = isEdit && existing?.status === "production";

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["assistants"] });

  const create = useCreateAssistant({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success("Assistant created");
        navigate("/assistants");
      },
      onError: () => toast.error("Failed to create assistant"),
    },
  });

  const update = useUpdateAssistant({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success("Assistant saved");
        navigate("/assistants");
      },
      onError: (e: any) =>
        toast.error(e?.data?.detail ?? "Failed to save assistant"),
    },
  });

  const publish = usePublishAssistant({
    mutation: {
      onSuccess: (a) => {
        invalidate();
        toast.success(`"${a.name}" is now live in production`);
        navigate("/assistants");
      },
      onError: () => toast.error("Failed to publish"),
    },
  });

  const unpublish = useUnpublishAssistant({
    mutation: {
      onSuccess: (a) => {
        invalidate();
        toast.success(`"${a.name}" moved to development`);
      },
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

  return (
    <AdminLayout
      title={isEdit ? `Edit: ${existing?.name ?? "…"}` : "New Assistant"}
    >
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
                This assistant is in production — all fields are locked. Move it
                to Development to make changes.
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
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General Settings</TabsTrigger>
              <TabsTrigger value="webhooks">Webhook Settings</TabsTrigger>
            </TabsList>

            {/* ── General Settings ───────────────────────────────────── */}
            <TabsContent value="general" className="space-y-6 pt-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Assistant Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Ciya – Citadel Sales"
                  disabled={isProduction}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
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
                  <p className="text-xs text-destructive">
                    {errors.welcome_message.message}
                  </p>
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
                  <p className="text-xs text-destructive">
                    {errors.system_prompt.message}
                  </p>
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
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
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
                        <SelectItem key={v.value} value={v.value}>
                          {v.label}
                        </SelectItem>
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
                    {MODEL_GROUPS.map((group, gi) => (
                      <Fragment key={group.label}>
                        {gi > 0 && <SelectSeparator />}
                        <SelectGroup>
                          <SelectLabel>{group.label}</SelectLabel>
                          {group.models.map((m) => (
                            <SelectItem
                              key={m.value}
                              value={m.value}
                              textValue={m.name}
                            >
                              <span className="font-medium">{m.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {m.note} · ${m.inputPer1M.toFixed(3)}/$
                                {m.outputPer1M.toFixed(3)} /1M
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Temperature */}
              <div className="space-y-1.5">
                <Label htmlFor="temperature">
                  Temperature
                  <span className="ml-2 text-muted-foreground font-normal">
                    {temperature} —{" "}
                    {temperature <= 0.3
                      ? "precise"
                      : temperature <= 0.6
                        ? "balanced"
                        : "creative"}
                  </span>
                </Label>
                <input
                  id="temperature"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={isProduction}
                  className="w-full h-2 rounded-lg cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  {...register("temperature")}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0 – Precise</span>
                  <span>1 – Creative</span>
                </div>
              </div>

              {/* Business Hours */}
              {/* <div className="space-y-1.5">
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
              </div> */}
            </TabsContent>

            {/* ── Webhook Settings ───────────────────────────────────── */}
            <TabsContent value="webhooks" className="space-y-6 pt-4">
              {/* Prefetch webhook */}
              <div className="space-y-1.5">
                <Label htmlFor="prefetch_webhook_url">
                  Prefetch Data Webhook
                </Label>
                <p className="text-xs text-muted-foreground">
                  Called via{" "}
                  <span className="font-mono bg-muted px-1 rounded">GET</span>{" "}
                  at the start of each call. Query params:{" "}
                  <span className="font-mono bg-muted px-1 rounded">
                    session_id
                  </span>
                  ,{" "}
                  <span className="font-mono bg-muted px-1 rounded">
                    agent_id
                  </span>
                  ,{" "}
                  <span className="font-mono bg-muted px-1 rounded">from</span>,{" "}
                  <span className="font-mono bg-muted px-1 rounded">to</span>.
                  Return{" "}
                  <span className="font-mono bg-muted px-1 rounded">
                    &#123;"context": "..."&#125;
                  </span>{" "}
                  to inject customer data into the system prompt.
                </p>
                <Input
                  id="prefetch_webhook_url"
                  placeholder="https://example.com/webhook/prefetch"
                  disabled={isProduction}
                  {...register("prefetch_webhook_url")}
                />
                {errors.prefetch_webhook_url && (
                  <p className="text-xs text-destructive">
                    {errors.prefetch_webhook_url.message}
                  </p>
                )}
              </div>

              {/* End-of-call webhook */}
              <div className="space-y-1.5">
                <Label htmlFor="end_of_call_webhook_url">
                  End of Call Webhook
                </Label>
                <p className="text-xs text-muted-foreground">
                  Called via{" "}
                  <span className="font-mono bg-muted px-1 rounded">POST</span>{" "}
                  after each call ends with the full conversation transcript,
                  duration, call status, and voip details.
                </p>
                <Input
                  id="end_of_call_webhook_url"
                  placeholder="https://example.com/webhook/end-of-call"
                  disabled={isProduction}
                  {...register("end_of_call_webhook_url")}
                />
                {errors.end_of_call_webhook_url && (
                  <p className="text-xs text-destructive">
                    {errors.end_of_call_webhook_url.message}
                  </p>
                )}
              </div>

              {/* Payload preview */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  End of Call — Example Payload
                </Label>
                <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto leading-relaxed text-muted-foreground">
                  {`{
  "session_id": "call123",
  "call_id": "call123",
  "agent_id": "uuid-of-assistant",
  "ts": 1729840680.886,
  "duration": 300,
  "chat": "[{\\"role\\":\\"user\\",\\"content\\":\\"Hi\\"},...]",
  "voip": { "provider": "plivo", "from": "+91...", "to": "+91..." },
  "call_status": "user-ended",
  "error_message": null,
  "chars_used": 1024,
  "agent_config": { ... }
}`}
                </pre>
              </div>
            </TabsContent>
          </Tabs>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            {!isProduction && (
              <Button
                type="submit"
                disabled={isSubmitting || create.isPending || update.isPending}
              >
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

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/assistants")}
            >
              {isProduction ? "Back" : "Cancel"}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
