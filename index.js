const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ============ CONFIGURAÇÕES ============
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'kenai_crm_verify_2026';

// ============ BANCO DE DADOS EM MEMÓRIA ============
let leads = [];

// ============ WEBHOOK DO META ============
app.get('/api/webhook/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/api/webhook/meta', (req, res) => {
  const body = req.body;
  
  if (body.object === 'page' && body.entry) {
    body.entry.forEach(entry => {
      entry.changes.forEach(change => {
        if (change.field === 'leadgen') {
          const leadData = change.value;
          const newLead = {
            id: Date.now() + Math.random(),
            meta_lead_id: leadData.leadgen_id,
            name: leadData.field_data?.find(f => f.name === 'full_name')?.values?.[0] || 'Sem nome',
            email: leadData.field_data?.find(f => f.name === 'email')?.values?.[0] || '',
            phone: leadData.field_data?.find(f => f.name === 'phone_number')?.values?.[0] || '',
            source: leadData.ad_name || 'Meta Ads',
            campaign: leadData.campaign_name || 'Desconhecida',
            status: 'novo',
            profissao: '',
            renda_atual: '',
            idade: '',
            cidade: '',
            networking: 0,
            perfil_aprovado: false,
            motivo_perda: '',
            score: 0,
            notes: '',
            date: new Date().toISOString()
          };
          leads.unshift(newLead);
          console.log('📥 Novo lead:', newLead.name);
        }
      });
    });
  }
  
  res.status(200).send('EVENT_RECEIVED');
});

// ============ API DO CRM ============

// Listar todos os leads
app.get('/api/leads', (req, res) => res.json(leads));

// Criar lead (POST)
app.post('/api/leads', (req, res) => {
  const lead = {
    id: Date.now(),
    ...req.body,
    date: new Date().toISOString()
  };
  leads.unshift(lead);
  res.status(201).json(lead);
});

// Pegar um lead
app.get('/api/leads/:id', (req, res) => {
  const lead = leads.find(l => l.id == req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  res.json(lead);
});

// Atualizar lead
app.patch('/api/leads/:id', (req, res) => {
  const index = leads.findIndex(l => l.id == req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Lead não encontrado' });
  leads[index] = { ...leads[index], ...req.body, updatedAt: new Date().toISOString() };
  res.json(leads[index]);
});

// Deletar lead
app.delete('/api/leads/:id', (req, res) => {
  leads = leads.filter(l => l.id != req.params.id);
  res.json({ success: true });
});

// Estatísticas
app.get('/api/leads/stats', (req, res) => {
  const total = leads.length;
  const byStatus = {};
  const byMotivoPerda = {};
  const byPerfilAprovado = { aprovado: 0, reprovado: 0, semAvaliacao: 0 };
  let totalNetworking = 0;
  let scoredLeads = 0;

  leads.forEach(l => {
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    if (l.motivo_perda) byMotivoPerda[l.motivo_perda] = (byMotivoPerda[l.motivo_perda] || 0) + 1;
    if (l.perfil_aprovado) byPerfilAprovado.aprovado++;
    else if (l.perfil_aprovado === false) byPerfilAprovado.reprovado++;
    else byPerfilAprovado.semAvaliacao++;
    if (l.networking) { totalNetworking += l.networking; scoredLeads++; }
  });

  res.json({
    total,
    byStatus,
    byMotivoPerda,
    byPerfilAprovado,
    avgNetworking: scoredLeads > 0 ? (totalNetworking / scoredLeads).toFixed(1) : 0
  });
});

// Health check
app.get('/api/healthz', (req, res) => res.status(200).json({ status: 'ok' }));

// ============ INICIAR SERVIDOR ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CRM Kenai rodando na porta ${PORT}`);
  console.log(`🔗 Health check: /api/healthz`);
  console.log(`🔗 API Leads: /api/leads`);
});

module.exports = app;
