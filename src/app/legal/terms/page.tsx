import type { Metadata } from "next";
import { legalContactEmail } from "@/lib/legal/contact";

export const metadata: Metadata = {
  title: "Terms of Service — Geotravel",
  description: "Terms of Service for the Geotravel reservation operations platform.",
};

export default function TermsPage() {
  const contact = legalContactEmail();
  return (
    <article className="prose prose-stone max-w-none prose-headings:scroll-mt-20">
      <h1 className="text-2xl font-semibold text-stone-900">
        Terms of Service / Termos de utilização
      </h1>
      <p className="text-sm text-stone-500">Última atualização / Last updated: 28 April 2026</p>

      <hr className="my-8 border-stone-200" />

      <h2 className="text-xl font-semibold">English</h2>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern access to and use of the Geotravel web
        application, APIs, webhooks, and related services (collectively, the &quot;Service&quot;)
        operated on behalf of your transport / mobility operator (&quot;Operator&quot;).
      </p>
      <h3 className="text-lg font-semibold">1. The Service</h3>
      <p>
        The Service supports reservation-related workflows (for example: messaging via WhatsApp
        Cloud API and SMS, enrichment, CRM write-back, and internal admin tools). Features depend
        on configuration and integrations enabled by the Operator.
      </p>
      <h3 className="text-lg font-semibold">2. Eligibility and accounts</h3>
      <p>
        Staff accounts are issued by the Operator. You are responsible for safeguarding credentials
        and for all activity under your account. The Operator may suspend or revoke access at any
        time.
      </p>
      <h3 className="text-lg font-semibold">3. Third-party channels (Meta / WhatsApp, SMS)</h3>
      <p>
        Use of WhatsApp is also subject to{" "}
        <a
          href="https://www.whatsapp.com/legal/business-terms"
          className="text-teal-800 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Meta&apos;s WhatsApp Business Terms
        </a>{" "}
        and related policies. SMS may be subject to carrier and provider terms (for example
        Twilio). You must comply with applicable law, obtain required consents, and honour opt-outs.
      </p>
      <h3 className="text-lg font-semibold">4. Acceptable use</h3>
      <p>
        You must not misuse the Service, probe or circumvent security, send unlawful or harassing
        content, or use the Service in a way that infringes third-party rights or violates
        anti-spam rules.
      </p>
      <h3 className="text-lg font-semibold">5. Data and privacy</h3>
      <p>
        Processing of personal data is described in the{" "}
        <a href="/legal/privacy" className="text-teal-800 underline">
          Privacy Policy
        </a>
        .
      </p>
      <h3 className="text-lg font-semibold">6. Disclaimers</h3>
      <p>
        The Service is provided &quot;as is&quot; to the extent permitted by law. Automated or
        AI-assisted outputs may be incorrect; the Operator remains responsible for decisions taken
        in its business.
      </p>
      <h3 className="text-lg font-semibold">7. Changes</h3>
      <p>
        The Operator may update these Terms. Material changes should be communicated through
        reasonable channels (for example email or in-app notice).
      </p>
      <h3 className="text-lg font-semibold">8. Contact</h3>
      <p>
        For contractual or operational questions, contact the Operator. For privacy-specific
        requests, use: <strong>{contact}</strong>
      </p>
      <p className="text-sm text-stone-500">
        This text is a practical template for app store / Meta disclosures and does not replace
        legal advice tailored to your jurisdiction or corporate structure.
      </p>

      <hr className="my-10 border-stone-200" />

      <h2 className="text-xl font-semibold">Português</h2>
      <p>
        Estes Termos de utilização (&quot;Termos&quot;) regem o acesso e a utilização da aplicação
        web Geotravel, APIs, webhooks e serviços associados (conjuntamente, o &quot;Serviço&quot;),
        explorados em nome do operador de transportes / mobilidade (&quot;Operador&quot;).
      </p>
      <h3 className="text-lg font-semibold">1. Objeto do Serviço</h3>
      <p>
        O Serviço apoia fluxos relacionados com reservas (por exemplo: mensagens via WhatsApp Cloud
        API e SMS, enriquecimento de dados, escrita em CRM e ferramentas de administração interna).
        As funcionalidades dependem da configuração e integrações ativadas pelo Operador.
      </p>
      <h3 className="text-lg font-semibold">2. Elegibilidade e contas</h3>
      <p>
        As contas de equipa são atribuídas pelo Operador. É responsável pela segurança das credenciais
        e por toda a atividade realizada na sua conta. O Operador pode suspender ou revogar o acesso
        a qualquer momento.
      </p>
      <h3 className="text-lg font-semibold">3. Canais de terceiros (Meta / WhatsApp, SMS)</h3>
      <p>
        A utilização do WhatsApp está também sujeita aos{" "}
        <a
          href="https://www.whatsapp.com/legal/business-terms"
          className="text-teal-800 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Termos comerciais do WhatsApp
        </a>{" "}
        e políticas relacionadas da Meta. O SMS pode estar sujeito a termos de operadoras e
        fornecedores (por exemplo Twilio). Deve cumprir a legislação aplicável, obter consentimentos
        necessários e respeitar pedidos de exclusão / opt-out.
      </p>
      <h3 className="text-lg font-semibold">4. Utilização aceitável</h3>
      <p>
        Não pode utilizar o Serviço de forma abusiva, contornar medidas de segurança, enviar
        conteúdo ilícito ou de assédio, nem violar direitos de terceiros ou regras anti-spam.
      </p>
      <h3 className="text-lg font-semibold">5. Dados e privacidade</h3>
      <p>
        O tratamento de dados pessoais é descrito na{" "}
        <a href="/legal/privacy" className="text-teal-800 underline">
          Política de privacidade
        </a>
        .
      </p>
      <h3 className="text-lg font-semibold">6. Limitação de responsabilidade</h3>
      <p>
        O Serviço é prestado &quot;no estado em que se encontra&quot;, na medida permitida pela lei.
        Resultados automáticos ou assistidos por IA podem conter erros; o Operador permanece
        responsável pelas decisões comerciais.
      </p>
      <h3 className="text-lg font-semibold">7. Alterações</h3>
      <p>
        O Operador pode atualizar estes Termos. Alterações materiais devem ser comunicadas por
        meios razoáveis (por exemplo email ou aviso na aplicação).
      </p>
      <h3 className="text-lg font-semibold">8. Contacto</h3>
      <p>
        Questões contratuais ou operacionais: contacte o Operador. Pedidos relacionados com
        privacidade: <strong>{contact}</strong>
      </p>
      <p className="text-sm text-stone-500">
        Texto modelo para divulgação junto de lojas de aplicações / Meta — não substitui parecer
        jurídico adequado à sua entidade ou jurisdição.
      </p>
    </article>
  );
}
