import type { Metadata } from "next";
import { legalContactEmail } from "@/lib/legal/contact";

export const metadata: Metadata = {
  title: "Privacy Policy — Geotravel",
  description:
    "Privacy policy for the Geotravel platform: WhatsApp, SMS, Supabase, and related processing.",
};

export default function PrivacyPage() {
  const contact = legalContactEmail();
  return (
    <article className="prose prose-stone max-w-none prose-headings:scroll-mt-20">
      <h1 className="text-2xl font-semibold text-stone-900">
        Privacy Policy / Política de privacidade
      </h1>
      <p className="text-sm text-stone-500">Última atualização / Last updated: 28 April 2026</p>

      <hr className="my-8 border-stone-200" />

      <h2 className="text-xl font-semibold">English</h2>
      <p>
        This Privacy Policy explains how the Geotravel platform (&quot;we&quot;, &quot;us&quot;)
        processes personal data on behalf of the transport / mobility operator (&quot;Operator&quot;)
        that deploys the software. The Operator is typically the data controller for passenger and
        customer data; technical subprocessors (hosting, messaging providers) act under the
        Operator&apos;s instructions where applicable.
      </p>
      <h3 className="text-lg font-semibold">1. Categories of data</h3>
      <ul>
        <li>
          <strong>Staff accounts:</strong> name, email, authentication metadata, role flags.
        </li>
        <li>
          <strong>Reservation / case data:</strong> booking references, itinerary-related fields,
          passenger contact details, message content received over channels, timestamps, and
          operational status fields stored in the Operator&apos;s database (for example Supabase).
        </li>
        <li>
          <strong>WhatsApp (Meta):</strong> when enabled, message payloads and phone identifiers
          processed through the WhatsApp Cloud API according to Meta&apos;s terms and technical flow.
        </li>
        <li>
          <strong>SMS:</strong> when enabled, phone numbers and message content via the configured
          SMS provider.
        </li>
        <li>
          <strong>Telemetry / logs:</strong> limited technical and security logs required to run the
          service (including hosting provider logs).
        </li>
      </ul>
      <h3 className="text-lg font-semibold">2. Purposes and legal bases (EU framing)</h3>
      <p>
        Processing is carried out for: (i) performing the contract between the Operator and its
        customers / passengers where relevant; (ii) legitimate interests in operating, securing, and
        improving the Service; (iii) compliance with legal obligations. Where consent is required
        (for example certain marketing messages), it is obtained separately by the Operator.
      </p>
      <h3 className="text-lg font-semibold">3. Recipients and transfers</h3>
      <p>
        Data may be processed by infrastructure and communications providers (including Meta for
        WhatsApp, SMS gateways, and cloud hosting). Some providers may be located outside the EEA;
        the Operator should ensure appropriate safeguards (for example Standard Contractual Clauses)
        where required.
      </p>
      <h3 className="text-lg font-semibold">4. Retention</h3>
      <p>
        Retention periods are determined by the Operator&apos;s business, legal, and accounting
        requirements. Technical backups may persist for a limited period after deletion requests
        are executed.
      </p>
      <h3 className="text-lg font-semibold">5. Your rights</h3>
      <p>
        Depending on jurisdiction, you may have rights to access, rectify, erase, restrict, object,
        and port personal data, and to lodge a complaint with a supervisory authority. To exercise
        rights regarding Operator-held passenger data, contact the Operator directly. For requests
        relating to data processed solely through this deployment, email:{" "}
        <strong>{contact}</strong>
      </p>
      <h3 className="text-lg font-semibold">6. Children</h3>
      <p>
        The Service is not directed at children. The Operator should not use the Service to collect
        personal data from children without appropriate legal grounds.
      </p>
      <h3 className="text-lg font-semibold">7. Changes</h3>
      <p>
        We may update this Policy. The &quot;Last updated&quot; date will change accordingly; material
        changes should be communicated by the Operator where appropriate.
      </p>

      <hr className="my-10 border-stone-200" />

      <h2 className="text-xl font-semibold">Português</h2>
      <p>
        Esta Política de privacidade explica como a plataforma Geotravel (&quot;nós&quot;) trata
        dados pessoais em nome do operador de transportes / mobilidade (&quot;Operador&quot;) que
        implementa o software. Em regra, o Operador é responsável pelo tratamento (responsável pelo
        tratamento) dos dados de passageiros e clientes; subprocessadores técnicos (alojamento,
        fornecedores de mensagens) atuam sob instruções do Operador, quando aplicável.
      </p>
      <h3 className="text-lg font-semibold">1. Categorias de dados</h3>
      <ul>
        <li>
          <strong>Contas de equipa:</strong> nome, email, metadados de autenticação, funções.
        </li>
        <li>
          <strong>Dados de reserva / casos:</strong> referências de reserva, campos relacionados com
          itinerário, contactos de passageiros, conteúdo de mensagens recebidas pelos canais,
          registos de data/hora e estados operacionais na base de dados do Operador (por exemplo
          Supabase).
        </li>
        <li>
          <strong>WhatsApp (Meta):</strong> quando ativo, payloads de mensagens e identificadores
          telefónicos processados via WhatsApp Cloud API, nos termos e fluxos técnicos da Meta.
        </li>
        <li>
          <strong>SMS:</strong> quando ativo, números e conteúdo via o fornecedor de SMS configurado.
        </li>
        <li>
          <strong>Telemetria / logs:</strong> registos técnicos e de segurança necessários ao
          funcionamento do serviço (incluindo logs do alojamento).
        </li>
      </ul>
      <h3 className="text-lg font-semibold">2. Finalidades e fundamentos de licitude (UE)</h3>
      <p>
        O tratamento destina-se a: (i) execução de contratos com clientes / passageiros, quando
        aplicável; (ii) interesses legítimos na exploração, segurança e melhoria do Serviço; (iii)
        cumprimento de obrigações legais. Quando for necessário consentimento (por exemplo certas
        comunicações de marketing), este é recolhido separadamente pelo Operador.
      </p>
      <h3 className="text-lg font-semibold">3. Destinatários e transferências</h3>
      <p>
        Os dados podem ser tratados por fornecedores de infraestruturas e comunicações (incluindo
        Meta para WhatsApp, gateways SMS e cloud). Alguns podem estar fora do EEE; o Operador deve
        assegurar garantias adequadas (por exemplo Cláusulas Contratuais-Tipo), quando exigido.
      </p>
      <h3 className="text-lg font-semibold">4. Conservação</h3>
      <p>
        Os prazos de conservação são definidos pelas necessidades comerciais, legais e contabilísticas
        do Operador. Cópias de segurança técnicas podem persistir por um período limitado após
        pedidos de eliminação.
      </p>
      <h3 className="text-lg font-semibold">5. Os seus direitos</h3>
      <p>
        Conforme a legislação aplicável, pode ter direitos de acesso, retificação, apagamento,
        limitação, oposição e portabilidade, e de apresentar reclamação à autoridade de controlo.
        Para dados de passageiros detidos pelo Operador, contacte o Operador. Para pedidos
        relacionados com esta implementação: <strong>{contact}</strong>
      </p>
      <h3 className="text-lg font-semibold">6. Menores</h3>
      <p>
        O Serviço não se dirige a menores. O Operador não deve utilizar o Serviço para recolher
        dados de menores sem fundamento legal adequado.
      </p>
      <h3 className="text-lg font-semibold">7. Alterações</h3>
      <p>
        Podemos atualizar esta Política. A data de &quot;Última atualização&quot; será alterada;
        mudanças materiais devem ser comunicadas pelo Operador quando apropriado.
      </p>

      <p className="mt-8 text-sm text-stone-500">
        Modelo informativo — valide com assessoria jurídica antes de publicação definitiva.
      </p>
    </article>
  );
}
