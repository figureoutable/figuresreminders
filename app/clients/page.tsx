import ClientsView, {
  type ClientEntity,
} from "@/components/clients-view";
import { createServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
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
