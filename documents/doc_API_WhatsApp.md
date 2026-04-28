The content on this page has been translated from English into another language using AI. The AI translated content may contain errors, omissions, or unintended meanings. Since AI translated language may be inaccurate or unclear, you may refer to the original source content in English for this page to review the intended guidance.
Sobre a Plataforma do WhatsApp Business
Updated: 5 de dez de 2025
A Plataforma do WhatsApp Business permite que as empresas se comuniquem com os clientes em grande escala.
Esta documentação é destinada a desenvolvedores que usam as nossas APIs. Para saber mais sobre outras maneiras de usar o WhatsApp para sua empresa, consulte o site do WhatsApp Business⁠.
Principais APIs e recursos
API de Nuvem do WhatsApp
A API de Nuvem do WhatsApp permite que você envie mensagens e faça ligações de forma programática no WhatsApp. A API de Nuvem pode ser usada para enviar aos usuários diferentes tipos de mensagens, desde SMSs simples a mensagens interativas e de mídia avançada.
A API de Nuvem do WhatsApp inclui o seguinte:
Mensagens: envie SMSs, mídias avançadas e mensagens interativas
Ligações: faça e receba ligações de clientes
Grupos: crie, gerencie e envie mensagens em conversas em grupo do WhatsApp.
As mensagens do WhatsApp oferecem uma maneira eficiente e privada de interagir com os clientes. Use a API de Nuvem para:
Enviar confirmações de pedidos e atualizações sobre o envio.
Informar a disponibilidade de horários e enviar outros lembretes.
Gerar oportunidades de upsell e venda cruzada.
Facilitar as transações do início ao fim, da descoberta do produto até o pagamento.
Ativar a autenticação multifatorial ou as senhas descartáveis para fazer a confirmação de contas e usuários.
Fornecer experiências de conversa interativas e personalizadas
Saiba mais sobre os tipos de mensagens na API de Nuvem do WhatsApp.
API de Gerenciamento de Negócios
A API de Gerenciamento do WhatsApp Business permite gerenciar programaticamente uma conta do WhatsApp Business e os ativos associados.
Gerencie ativos de conta com a API de Gerenciamento do WhatsApp Business, como:
Números de telefone comerciais: adicione e remova números de telefone associados à sua empresa.
Modelos: crie e modifique modelos de mensagens para mensagens escaláveis.
A API de Gerenciamento do WhatsApp Business também dá acesso a análises da conta, como:
Análise de mensagens: o número e o tipo de mensagens enviadas e entregues.
Análise de preços: detalhamentos de preços granulares para mensagens entregues.
Análise de modelos: métricas de modelos enviados/lidos/entregues, além de cliques no botão de mensagem do modelo.
Saiba mais sobre modelos de mensagem.
Saiba mais sobre como gerenciar números de telefone comerciais.
Saiba mais sobre análises de conta.
API de Mensagens de Marketing para o WhatsApp
A API de Mensagens de Marketing é uma API para enviar mensagens de marketing otimizadas no WhatsApp.
Ao enviar mensagens de marketing por meio da API de Mensagens de Marketing para o WhatsApp, você pode acessar novos recursos não disponíveis na API de Nuvem e receber otimizações automáticas para que as mensagens de alto engajamento alcancem mais clientes.
A API de Mensagens de Marketing para o WhatsApp inclui:
Entrega baseada em qualidade: até 9% de aumento na entrega de mensagens de marketing via API de Nuvem para conteúdo de alto engajamento.
Otimizações de criativos automatizadas: aprimore automaticamente o criativo de marketing para melhorar o desempenho das mensagens.
Referências de desempenho e recomendações: comparação de taxas de leitura e cliques em relação a modelos semelhantes de empresas na sua região.
Métricas de conversão: mensure as mensagens de marketing que levam os usuários a realizar eventos no app, como "Adicionar ao carrinho", "Finalização da compra iniciada" ou "Comprar".
Saiba mais sobre a API de Mensagens de Marketing para o WhatsApp.
Webhooks
Os webhooks entregam cargas JSON ao servidor para atualizações de status da mensagem, mensagens recebidas, gerenciamento de erros assíncronos e muitos outros serviços de notificação.
A plataforma depende totalmente dos webhooks. Isso porque o conteúdo de qualquer mensagem enviada por um usuário do WhatsApp ao seu número de telefone comercial é transmitido como um webhook, e todas as atualizações de status de entrega de mensagens enviadas são registradas via webhook.
Saiba mais sobre webhooks.
Fundamentos técnicos
Protocolo HTTP e solicitações de API
A Plataforma do WhatsApp Business foi desenvolvida com base na Graph API e usa o protocolo HTTP. As solicitações de API incluem parâmetros de caminho, corpo e cabeçalho.
Exemplo: como enviar uma mensagem de texto usando cURL
curl 'https://graph.facebook.com/v17.0/106540352242922/messages' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer EAAJB...' \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "+16505555555",
    "type": "text",
    "text": {
      "preview_url": true,
      "body": "Here's the info you requested! https://www.meta.com/quest/quest-3/"
    }
  }'
Saiba mais sobre a Graph API.
Respostas JSON
As respostas da API são formatadas em JSON.
Exemplo: como pedir os metadados de um número de telefone comercial
{
  "verified_name": "Lucky Shrub",
  "code_verification_status": "VERIFIED",
  "display_phone_number": "15550783881",
  "quality_rating": "GREEN",
  "platform_type": "CLOUD_API",
  "throughput": {
    "level": "STANDARD"
  },
  "webhook_configuration": {
    "application": "https://www.luckyshrub.com/webhooks"
  },
  "id": "106540352242922"
}
Autenticação e autorização
A autenticação usa tokens de acesso OAuth (não 2.0), enquanto as permissões restringem o acesso a recursos específicos.
Saiba mais sobre os tokens de acesso.
Saiba mais sobre permissões.
Principais recursos
Portfólios empresariais
Com o portfólio empresarial, as organizações podem reunir todos os ativos de negócios da Meta para gerenciá-los em um só lugar. Na Plataforma do WhatsApp Business, um portfólio empresarial serve principalmente como um contêiner para contas do WhatsApp Business (WABA). É preciso ter um portfólio empresarial para usar a plataforma.
Os portfólios empresariais podem ser verificados, e o status de verificação contribui para melhorar a funcionalidade, como maior taxa de transferência de dados e o status de conta comercial oficial.
Saiba mais sobre portfólios empresariais⁠.
Contas do WhatsApp Business (WABA)
Uma conta do WhatsApp Business representa sua empresa, armazenando metadados e vinculando-a a números de telefone, modelos e análises.
Saiba mais sobre as contas do WhatsApp Business.
Números de telefone comerciais
Os números de telefone comerciais, reais ou virtuais, são usados para enviar e receber mensagens do WhatsApp. Eles podem ter nomes de exibição e receber o status de conta comercial oficial.
Saiba mais sobre números de telefone comercial.
Modelos de mensagem
Os modelos são mensagens personalizáveis que você pode criar antes do envio. Em geral, os modelos de mensagem precisam ser aprovados antes do envio.
Os modelos são úteis para enviar mensagens em escala. Além disso, eles são o único tipo de mensagem que pode ser enviado a usuários do WhatsApp fora da janela de atendimento ao cliente.
Os modelos têm pontuações de qualidade e estão sujeitos a vários limites de mensagens.
Saiba mais sobre modelos de mensagem.
Recursos de teste
Depois que você começar a usar a API de Nuvem, uma WABA e um número de telefone comercial de teste serão criados automaticamente para você. As WABAs e os números de telefone de teste são úteis para fazer experimentos, já que eles flexibilizaram os limites de mensagens e não exigem uma forma de pagamento registada para enviar mensagens de modelo.
Será possível excluir seu portfólio empresarial e os respectivos recursos de teste se:
você for um administrador do portfólio empresarial associada ao app;
nenhum outro app estiver associado ao portfólio empresarial;
o portfólio empresarial não estiver associada a nenhuma outra WABA;
a WABA não estiver associada a nenhum outro número de telefone comercial.
Para excluir seu portfólio empresarial e os respectivos recursos de teste:
Acesse Painel de Apps > WhatsApp > Configuração.
Encontre a seção Conta de teste.
Clique no botão Excluir.
Recomendamos usar o API Playground ao testar os pontos de extremidade. A área de teste está disponível na seção "Referência da API", na barra lateral esquerda desta página. Em cada referência, existe um botão "Experimentar" que abre o playground.
Além disso, a coleção Postman⁠ é útil para testes.
Ferramentas e integrações
Gerenciador do WhatsApp
O Gerenciador do WhatsApp é um app para web que permite o gerenciamento de WABAs, números de telefone, modelos e análises.
Acessar o Gerenciador do WhatsApp⁠
SDKs de terceiros
Alguns SDKs, como PyWa⁠ (wrapper Python), estão disponíveis, mas não são mantidos ou endossados pela Meta.
Coleção Postman
A coleção Postman oficial permite executar consultas comuns de API.
Acesse a coleção Postman da Plataforma do WhatsApp Business.⁠
Segurança e desempenho
Taxa de transferência
Os números de telefone comercial podem enviar até 80 mensagens por segundo por padrão, com atualizações de capacidade disponíveis.
Saiba mais sobre taxa de transferência.
Criptografia
Com a API de Nuvem, todas as mensagens do WhatsApp continuam sendo protegidas pela criptografia do protocolo Signal desde antes de deixarem o dispositivo. Isso significa que as mensagens com uma WABA são entregues com segurança ao destino escolhido pela empresa.
A API de Nuvem aplica técnicas padrão de criptografia da indústria para proteger dados em trânsito e em repouso. Ela usa a Graph API para enviar mensagens e Webhooks a fim de receber eventos. Ambos operam com HTTPS padrão da indústria protegido por TLS. Consulte o documento técnico Visão Geral da Criptografia para saber mais.
Para saber mais, consulte o relatório técnico Visão Geral da Criptografia do WhatsApp⁠.
Dimensionamento
A API de Nuvem dimensiona automaticamente o uso dentro dos limites de volume.
Limites de volume
As solicitações feitas pelo seu app na sua conta do WhatsApp Business (WABA) são contabilizadas na contagem de solicitações do app. A contagem de solicitações de um app é o número de solicitações que ele pode fazer durante uma hora.
Para os seguintes pontos de extremidade, por padrão, seu app pode fazer 200 solicitações por hora, por app e por WABA. Para WABAs ativas com pelo menos um número de telefone registrado, esse limite é de 5 mil solicitações por hora.
Tipo de solicitação	Ponto de extremidade
GET
/<WHATSAPP_BUSINESS_ACCOUNT_ID>
GET, POST e DELETE
/<WHATSAPP_BUSINESS_ACCOUNT_ID>/assigned_users
GET
/<WHATSAPP_BUSINESS_ACCOUNT_ID>/phone_numbers
GET, POST e DELETE
/<WHATSAPP_BUSINESS_ACCOUNT_ID>/message_templates
GET, POST e DELETE
/<WHATSAPP_BUSINESS_ACCOUNT_ID>/subscribed_apps
GET
/<WHATSAPP_BUSINESS_ACCOUNT_TO_NUMBER_CURRENT_STATUS_ID>
Para as solicitações da API de Linha de Crédito a seguir, o seu app pode fazer 5 mil solicitações por hora.
Tipo de solicitação	Ponto de extremidade
GET
/<BUSINESS_ID>/extendedcredits
POST
/<EXTENDED_CREDIT_ID>/whatsapp_credit_sharing_and_attach
GET e DELETE
/<ALLOCATION_CONFIG_ID>
GET
/<EXTENDED_CREDIT_ID>/owning_credit_allocation_configs
Para ver informações adicionais sobre como obter a utilização do limite de volume atual, consulte Cabeçalhos.
Além disso, a plataforma aplica vários limites de volume de mensagens:
Testar o limite de volume de mensagens (para WABAs não verificadas)
Limites de mensagens e classificação de qualidade (para WABAs verificadas)
Limite de volume de capacidade (para todas as contas)
Limite de volume de telefonia comercial (por número de telefone)
Limites de volume de pareamento
Os números de telefone comercial podem enviar uma mensagem a cada 6 segundos para o mesmo usuário do WhatsApp (0,17 mensagem por segundo), o que é equivalente a cerca de 10 mensagens por minuto ou 600 por hora. Exceder esse limite gera o código de erro 131056 até que você fique dentro da taxa permitida novamente.
É possível enviar até 45 mensagens em um período de seis segundos, mas essa ação tomará "emprestado" parte da sua cota futura. Após um pico no uso, é preciso esperar o tempo equivalente ao que levaria para enviar essas mensagens dentro da taxa normal (por exemplo, uma pico de 20 mensagens requer uma espera de aproximadamente dois minutos para enviar mais mensagens para o usuário).
Para gerenciar a limitação após o pico, se um pedido de envio falhar, tente novamente após 4^X segundos (começando com X=0 e aumentando X em uma unidade após cada falha) até ter sucesso.

---

## Mapeamento Geotravel (implementação)

| Tópico da doc | Onde está no código |
|---------------|----------------------|
| Payload de texto (`messaging_product`, `recipient_type`, `preview_url`) | `src/lib/messaging/meta-whatsapp.ts` |
| Limite por utilizador / erro 131056 / HTTP 429 — retry 4^X s | `src/lib/messaging/meta-whatsapp.ts` (`sendWhatsAppMessage`) |
| Webhook (200 após persistir) | `src/app/api/webhooks/whatsapp/route.ts` — `await processInboundMessaging` (fiável em serverless; evita `after()` cortado antes do insert) |
| Variáveis de ambiente | `.env.example` (`WHATSAPP_*`) |
| Teste manual de envio | `npm run whatsapp:smoke` → `scripts/whatsapp-smoke.ts` |

Para ativar pré-visualização de URL em texto livre, use `linkPreview: true` em `OutboundMessage` ou em `sendViaPreferredChannel`.