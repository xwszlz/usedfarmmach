import MaintenanceClient from "./MaintenanceClient";

export default function MaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <MaintenanceClient />;
}
