import type { Metadata } from "next";
import { legalContactEmail } from "@/lib/legal/contact";

export const metadata: Metadata = {
  title: "User data deletion — Geotravel",
  description:
    "How to request deletion of personal data processed through the Geotravel platform.",
};

export default function DataDeletionPage() {
  const contact = legalContactEmail();
  return (
    <article className="max-w-none space-y-4 text-stone-800 dark:text-stone-300 [&_h1]:scroll-mt-20 [&_h2]:mt-8 [&_h2]:scroll-mt-20 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-stone-900 [&_h2]:dark:text-stone-50 [&_h3]:mt-6 [&_h3]:scroll-mt-20 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-stone-900 [&_h3]:dark:text-stone-50 [&_hr]:my-8 [&_hr]:border-stone-200 [&_hr]:dark:border-stone-700 [&_a]:text-teal-800 [&_a]:underline [&_a]:dark:text-teal-300 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
      <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
        User data deletion / Eliminação de dados do utilizador
      </h1>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Última atualização / Last updated: 28 April 2026
      </p>

      <hr className="my-8 border-stone-200 dark:border-stone-700" />

      <h2 className="text-xl font-semibold">English</h2>
      <p>
        This page describes how individuals can request deletion of personal data processed through
        the Geotravel platform when the Operator uses WhatsApp, SMS, or related features.
      </p>
      <h3 className="text-lg font-semibold">1. Who can request deletion</h3>
      <ul>
        <li>
          <strong>Passengers / end users</strong> who interacted with the Operator via WhatsApp or
          SMS should contact the Operator (the business that served them). The Operator controls
          booking records and can delete or anonymise data in its systems.
        </li>
        <li>
          <strong>Staff users</strong> with login access may request account closure or deletion of
          the staff profile through the Operator&apos;s administrator.
        </li>
      </ul>
      <h3 className="text-lg font-semibold">2. How to submit a request</h3>
      <p>
        Email <strong>{contact}</strong> with the subject line{" "}
        <strong>&quot;Data deletion request&quot;</strong> and include:
      </p>
      <ul>
        <li>Your full name;</li>
        <li>The phone number (in international format) or email used in the interaction;</li>
        <li>Rough date of the conversation or booking reference, if known;</li>
        <li>A brief description of what you want deleted (messages, profile, entire booking record).</li>
      </ul>
      <p>
        We may need to verify identity before processing. If your request concerns data held only by
        Meta/WhatsApp infrastructure, Meta&apos;s own tools and policies may also apply; the
        Operator remains your first point of contact for service-related data.
      </p>
      <h3 className="text-lg font-semibold">3. What we will do</h3>
      <p>
        Within approximately <strong>30 days</strong> of a valid request (or sooner where feasible),
        the Operator or its technical team will delete or irreversibly anonymise personal data in the
        Geotravel-controlled databases, except where retention is required by law (for example tax
        or transport regulations).
      </p>
      <h3 className="text-lg font-semibold">4. What may be retained</h3>
      <p>
        Aggregated statistics with no identifiable individuals, security logs strictly necessary to
        demonstrate compliance, and records the Operator must keep by law may be retained in
        minimised form.
      </p>

      <hr className="my-10 border-stone-200" />

      <h2 className="text-xl font-semibold">Português</h2>
      <p>
        Esta página descreve como pode pedir a eliminação de dados pessoais tratados através da
        plataforma Geotravel quando o Operador utiliza WhatsApp, SMS ou funcionalidades associadas.
      </p>
      <h3 className="text-lg font-semibold">1. Quem pode pedir eliminação</h3>
      <ul>
        <li>
          <strong>Passageiros / utilizadores finais</strong> que contactaram o Operador via WhatsApp
          ou SMS devem contactar o Operador (a empresa que prestou o serviço). O Operador controla
          os registos de reserva e pode apagar ou anonimizar dados nos seus sistemas.
        </li>
        <li>
          <strong>Utilizadores com conta de equipa</strong> podem pedir encerramento de conta ou
          eliminação do perfil através do administrador do Operador.
        </li>
      </ul>
      <h3 className="text-lg font-semibold">2. Como enviar o pedido</h3>
      <p>
        Envie email para <strong>{contact}</strong> com o assunto{" "}
        <strong>&quot;Pedido de eliminação de dados&quot;</strong> e inclua:
      </p>
      <ul>
        <li>Nome completo;</li>
        <li>
          Número de telefone (formato internacional) ou email utilizado na interação;
        </li>
        <li>Data aproximada da conversa ou referência de reserva, se souber;</li>
        <li>
          Breve descrição do que pretende eliminar (mensagens, perfil, registo completo de reserva).
        </li>
      </ul>
      <p>
        Poderá ser necessário verificar a identidade antes de processar. Se o pedido diz respeito a
        dados apenas na infraestrutura Meta/WhatsApp, podem aplicar-se ferramentas e políticas da
        Meta; o Operador continua a ser o primeiro contacto para dados do serviço.
      </p>
      <h3 className="text-lg font-semibold">3. O que faremos</h3>
      <p>
        No prazo aproximado de <strong>30 dias</strong> após um pedido válido (ou antes, quando
        possível), o Operador ou a equipa técnica eliminará ou anonimizará de forma irreversível os
        dados pessoais nas bases de dados sob controlo Geotravel, salvo quando a conservação for
        exigida por lei (por exemplo obrigações fiscais ou de transporte).
      </p>
      <h3 className="text-lg font-semibold">4. O que pode ser conservado</h3>
      <p>
        Estatísticas agregadas sem identificação de pessoas singulares, registos de segurança
        estritamente necessários para demonstrar conformidade, e registos que o Operador deva manter
        por lei podem ser conservados de forma minimizada.
      </p>

      <p className="mt-8 text-sm text-stone-500">
        Modelo informativo — ajuste prazos e contactos ao processo interno do Operador e valide com
        assessoria jurídica.
      </p>
    </article>
  );
}
