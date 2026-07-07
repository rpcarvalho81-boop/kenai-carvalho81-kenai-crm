const express = require('express');
const https = require('https');
const app = express();
const port = process.env.PORT || 10000;

// Middleware para aceitar JSON
app.use(express.json());

// Configuração do WhatsApp (CallMeBot)
const WHATSAPP_PHONE = '5511920197432';
const WHATSAPP_APIKEY = '9975884';

// Função para enviar mensagem no WhatsApp
function sendWhatsAppMessage(message) {
  return new Promise((resolve, reject) => {
    const encodedMessage = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${WHATSAPP_PHONE}&text=${encodedMessage}&apikey=${WHATSAPP_APIKEY}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('WhatsApp enviado:', data);
        resolve(data);
      });
    }).on('error', (err) => {
      console.error('Erro WhatsApp:', err);
      reject(err);
    });
  });
}

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Kenai CRM API',
    endpoints: {
      health: '/api/healthz',
      leads: '/api/leads'
    }
  });
});

// Health check
app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET leads (consultar)
app.get('/api/leads', (req, res) => {
  res.json({ leads: [], message: 'Endpoint de leads' });
});

// POST leads (receber do LeadsBridge/Meta)
app.post('/api/leads', async (req, res) => {
  console.log('=== LEAD RECEBIDO ===');
  console.log('Data:', new Date().toISOString());
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Extrair dados do lead (ajuste conforme os campos mapeados no LeadsBridge)
    const leadData = req.body;
    const nome = leadData.full_name || leadData.name || 'Não informado';
    const email = leadData.email || 'Não informado';
    const telefone = leadData.phone_number || leadData.phone || 'Não informado';
    const cidade = leadData.city || 'Não informado';
    const formulario = leadData.form_name || 'Meta Ads';
    
    // Montar mensagem para WhatsApp
    const mensagem = `📢 *NOVO LEAD - Meta Ads*

👤 *Nome:* ${nome}
📧 *Email:* ${email}
📱 *Telefone:* ${telefone}
🏙️ *Cidade:* ${cidade}
📋 *Formulário:* ${formulario}

⏰ Recebido em: ${new Date().toLocaleString('pt-BR')}

💼 Acesse o CRM: https://kenai-crm.onrender.com`;

    // Enviar WhatsApp
    await sendWhatsAppMessage(mensagem);
    console.log('✅ WhatsApp enviado com sucesso!');
    
    res.status(200).json({ 
      status: 'success', 
      message: 'Lead recebido e notificação enviada',
      received: true
    });
    
  } catch (error) {
    console.error('❌ Erro ao processar lead:', error);
    res.status(200).json({ 
      status: 'success', 
      message: 'Lead recebido (erro no WhatsApp)',
      received: true,
      whatsapp_error: true
    });
  }
});

app.listen(port, () => {
  console.log(`Kenai CRM rodando na porta ${port}`);
});
