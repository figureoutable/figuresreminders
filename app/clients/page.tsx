import ClientsView, {
  type ClientEntity,
} from "@/components/clients-view";
import { tryCreateServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const supabase = tryCreateServiceSupabase();
  if (!supabase) {
    return (
      <ClientsView
        editingClient={null}
        initialClients={[]}
        key="err"
        loadError="Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your host’s environment variables, then redeploy."
      />
    );
  }

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <ClientsView
        editingClient={null}
        initialClients={[]}
        key="err"
        loadError={`Could not load clients (${error.message}). Run the SQL migrations in supabase/migrations on your Supabase project if tables are missing.`}
      />
    );
  }

  const list = (data ?? []) as ClientEntity[];
  const editingClient = edit ? (list.find((c) => c.id === edit) ?? null) : null;
  return (
    <ClientsView
      key={edit ?? "new"}
      editingClient={editingClient}
      initialClients={list}
    />
  );
}
