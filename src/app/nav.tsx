import { getStaff, isKiosk } from "@/lib/auth";
import { logout } from "./actions";
import { NavLinks } from "./nav-links";

export async function Nav() {
  // Kiosk mode: no staff links, even for the moment before a typed URL redirects to /signup.
  const staff = (await isKiosk()) ? null : await getStaff();
  const links: [string, string][] = !staff
    ? []
    : staff.role === "owner"
      ? [["/", "Today"], ["/checkin", "Check-in"], ["/members", "Members"], ["/payments", "Payments"], ["/outbox", "Reminders"]]
      : [["/checkin", "Check-in"], ["/members", "Members"], ["/payments", "Payments"]];
  return (
    <nav className="flex h-14 items-center gap-1 bg-rubber px-4 text-white">
      <span className="mr-4 font-display text-2xl font-bold">GymDesk</span>
      {staff && <NavLinks links={links} staffName={staff.name} logout={logout} />}
    </nav>
  );
}
