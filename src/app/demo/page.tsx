import type { Metadata } from "next";
import { demoLogin } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "GymDesk demo",
  description: "Sample gym system: QR check-in, walk-ins, payments, auto SMS reminders, and an owner dashboard.",
};

type Feature = { title: string; points: string[]; img?: string; to: string; role?: "owner" | "desk"; edge: string };

const FEATURES: Feature[] = [
  {
    title: "Owner dashboard",
    points: [
      "Kita ngayong araw, check-ins, walk-ins, at bagong members, kahit wala ka sa gym.",
      "\"Recovered\": magkano ang bumalik dahil sa reminders.",
      "Follow-up list ng mga ma-e-expire, may Text at Call button.",
    ],
    img: "today",
    to: "/",
    edge: "border-l-plate-blue",
  },
  {
    title: "QR check-in at walk-ins (daily)",
    points: [
      "Scan lang ng QR ng member sa pinto: green pasok, yellow malapit na mag-expire, red expired.",
      "Pag pinapasok ng staff ang expired, naka-record at makikita ng owner.",
      "Walk-in o daily: i-type ang bayad, Record walk-in. Kasama sa kita at cash ng staff.",
    ],
    img: "card",
    to: "/checkin",
    role: "desk",
    edge: "border-l-plate-green",
  },
  {
    title: "Members",
    points: [
      "Hanapin by name, i-filter kung active, expiring, o expired.",
      "Bagong member: pangalan, number, at photo gamit ang tablet camera.",
      "Renew via cash o GCash/Maya. Auto-extend ang membership pag bayad na.",
    ],
    img: "member",
    to: "/members",
    edge: "border-l-plate-yellow",
  },
  {
    title: "Payments at cash ng bawat staff",
    points: [
      "Makikita kung magkano ang cash na hawak ng bawat staff ngayong araw.",
      "Hindi ma-delete ng staff ang bayad. Owner lang ang pwedeng mag-void, at kita pa rin.",
      "Day, week, at month na view.",
    ],
    img: "payments",
    to: "/payments",
    edge: "border-l-plate-red",
  },
  {
    title: "Auto SMS reminders",
    points: [
      "Gabi-gabi, automatic na tine-text ang mga ma-e-expire at bagong expire.",
      "May daily summary din si owner: kita, check-ins, walk-ins.",
      "Sa demo, dito lang lumalabas ang texts (hindi talaga sine-send).",
    ],
    img: "outbox",
    to: "/outbox",
    edge: "border-l-plate-blue",
  },
];

const TRY = [
  ["owner", "/", "Tingnan ang Today: kita, walk-ins, at follow-up list."],
  ["owner", "/outbox", "Pindutin ang Send reminders now para makita ang Taglish na texts."],
  ["owner", "/members", "Filter by Expired, buksan ang isang member, at kopyahin ang member code."],
  ["desk", "/checkin", "I-paste ang code sa Check-in: lalabas ang red. Subukan din ang Record walk-in."],
  ["owner", "/payments", "Tingnan ang cash ng bawat staff, at subukang i-void ang isang bayad."],
] as const;

function TryButton({ role = "owner", to, children, variant }: { role?: "owner" | "desk"; to: string; children: React.ReactNode; variant?: "outline" }) {
  return (
    <form action={demoLogin.bind(null, role, to)}>
      <Button size="lg" variant={variant}>{children}</Button>
    </form>
  );
}

export default function Page() {
  return (
    <div className="space-y-10 pb-16 md:h-full md:overflow-y-auto">
      <section className="space-y-4">
        <p className="font-display text-sm font-bold tracking-widest text-plate-blue">SAMPLE SYSTEM</p>
        <h1 className="font-display text-5xl leading-none font-bold">GymDesk</h1>
        <p className="max-w-2xl text-lg">
          Ito po yung sample na ginawa ko para sa maliliit na gym. Yung gagawin ko para sa gym niyo, ina-adjust ko depende
          sa kung paano kayo mag-operate: pangalan, presyo, plans, at features na kailangan niyo lang.
        </p>
        <div className="flex flex-wrap gap-3">
          <TryButton to="/">Subukan bilang Owner</TryButton>
          <TryButton role="desk" to="/checkin" variant="outline">Subukan bilang Front desk</TryButton>
        </div>
        <p className="muted">Pindutin ang <b>GymDesk</b> sa taas para bumalik dito. Demo data lang po ito. Walang totoong members, at walang totoong text o bayad na lumalabas.</p>
      </section>

      <section className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr] md:items-center">
        <video src="/demo/hook.mp4" poster="/demo/hook-poster.webp" controls playsInline preload="metadata" className="w-full max-w-xs rounded-xl bg-rubber" />
        <div className="space-y-2">
          <h2 className="font-display text-3xl font-bold">Sa loob ng 1 minuto</h2>
          <p>Panoorin ang maikling video, tapos subukan mismo ang system gamit ang mga button sa baba. Isang click lang, walang PIN.</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="font-display text-3xl font-bold">Features</h2>
        {FEATURES.map((f) => (
          <Card key={f.title} className={`grid gap-5 border-l-4 p-5 md:grid-cols-[1fr_260px] ${f.edge}`}>
            <div className="space-y-3">
              <h3 className="font-display text-2xl font-bold">{f.title}</h3>
              <ul className="list-disc space-y-1 pl-5">
                {f.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
              <TryButton role={f.role} to={f.to} variant="outline">Subukan</TryButton>
            </div>
            {f.img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/demo/${f.img}.webp`} alt={`${f.title} screen`} loading="lazy"
                className="h-80 w-full rounded-lg border object-cover object-top" />
            )}
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-3xl font-bold">Subukan in 2 minutes</h2>
        <ol className="space-y-3">
          {TRY.map(([role, to, text], i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rubber font-display font-bold text-white">{i + 1}</span>
              <span className="flex-1">{text}</span>
              <form action={demoLogin.bind(null, role, to)}><Button size="sm" variant="outline">Go</Button></form>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3 rounded-xl bg-rubber p-6 text-white">
        <h2 className="font-display text-3xl font-bold">Custom para sa gym niyo</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Pangalan at logo ng gym niyo.</li>
          <li>Sarili niyong plans at presyo: monthly, student, walk-in, at iba pa.</li>
          <li>Features na kailangan niyo lang. Pwede ring pag-usapan ang iba pang gusto niyo.</li>
          <li>Gumagana sa phone at tablet. Walang kailangang i-install.</li>
        </ul>
        <p className="text-lg font-semibold text-plate-yellow">Interesado po? Reply lang sa Messenger chat natin.</p>
      </section>
    </div>
  );
}
