// Landing page that explains the current scope of the web application.
import { HomeActions } from "@/components/layout/HomeActions";
import { PageContainer } from "@/components/layout/PageContainer";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";

export default function HomePage() {
  return (
    <PageContainer>
      <section className="hero card">
        <p className="eyebrow">Inicio</p>
        <h2>Certificacion academica digital con blockchain</h2>
        <p>Emita, verifique y consulte títulos académicos con respaldo digital seguro y trazable.</p>
        <HomeActions />
      </section>
      <InsightsPanel />
    </PageContainer>
  );
}
