import { useAuth } from "@/hooks/useAuth";
import { useCustomers } from "@/hooks/useCustomers";
import { LoginPage } from "@/components/LoginPage";
import { CustomersView } from "@/components/CustomersView";
import { Workspace } from "@/components/Workspace";
import { SpinnerIcon } from "@/components/icons";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <SpinnerIcon className="size-6 animate-spin text-stone" />
    </div>
  );
}

/**
 * The app's gate: signed out -> LoginPage, signed in but no customer entered ->
 * CustomersView, customer entered -> the actual app (Workspace). Workspace is mounted
 * with `key={activeCustomer.id}` so switching customers remounts every data hook fresh —
 * see Workspace.tsx's doc comment.
 */
export default function App() {
  const auth = useAuth();
  const customers = useCustomers(auth.setActiveCustomerId);

  if (auth.checking) return <LoadingScreen />;

  if (!auth.user) {
    return <LoginPage onLogin={auth.login} onRegister={auth.register} />;
  }

  if (!auth.user.activeCustomerId) {
    return (
      <CustomersView
        userName={auth.user.name}
        customers={customers.customers}
        loaded={customers.loaded}
        onCreate={customers.addCustomer}
        onPatch={customers.patchCustomer}
        onDelete={customers.removeCustomer}
        onSetPhoto={customers.setPhoto}
        onEnter={customers.enterCustomer}
        onLogout={auth.logout}
      />
    );
  }

  const activeCustomer = customers.customers.find(
    (c) => c.id === auth.user!.activeCustomerId,
  );
  if (!activeCustomer) return <LoadingScreen />;

  return (
    <Workspace
      key={activeCustomer.id}
      customer={activeCustomer}
      onLeaveCustomer={() => void customers.leaveCustomer()}
      onLogout={() => void auth.logout()}
    />
  );
}
