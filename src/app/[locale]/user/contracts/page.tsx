import ContractsClient from "./ContractsClient";

export default function ContractsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <ContractsClient />;
}
