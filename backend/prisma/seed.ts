import { PrismaClient, PlanType, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // ── Tenant principal (Toque de Cor) ───────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'toque-de-cor' },
    update: {},
    create: {
      name: 'Toque de Cor',
      slug: 'toque-de-cor',
      cnpj: '00.000.000/0001-00',
      plan: PlanType.ENTERPRISE,
      maxStores: 25,
      maxUsers: 100,
    },
  });
  console.log('✅ Tenant criado:', tenant.name);

  // ── 18 Lojas ──────────────────────────────────────────────────
  const storeData = [
    { code: 'SP01', name: 'Toque de Cor – Centro SP', city: 'São Paulo', state: 'SP', whatsapp: '5511900000001' },
    { code: 'SP02', name: 'Toque de Cor – Pinheiros', city: 'São Paulo', state: 'SP', whatsapp: '5511900000002' },
    { code: 'SP03', name: 'Toque de Cor – Santo André', city: 'Santo André', state: 'SP', whatsapp: '5511900000003' },
    { code: 'SP04', name: 'Toque de Cor – Guarulhos', city: 'Guarulhos', state: 'SP', whatsapp: '5511900000004' },
    { code: 'SP05', name: 'Toque de Cor – Campinas', city: 'Campinas', state: 'SP', whatsapp: '5519900000005' },
    { code: 'SP06', name: 'Toque de Cor – Sorocaba', city: 'Sorocaba', state: 'SP', whatsapp: '5515900000006' },
    { code: 'SP07', name: 'Toque de Cor – Barueri', city: 'Barueri', state: 'SP', whatsapp: '5511900000007' },
    { code: 'SP08', name: 'Toque de Cor – Osasco', city: 'Osasco', state: 'SP', whatsapp: '5511900000008' },
    { code: 'SP09', name: 'Toque de Cor – São Bernardo', city: 'São Bernardo do Campo', state: 'SP', whatsapp: '5511900000009' },
    { code: 'RJ01', name: 'Toque de Cor – Centro RJ', city: 'Rio de Janeiro', state: 'RJ', whatsapp: '5521900000010' },
    { code: 'RJ02', name: 'Toque de Cor – Barra da Tijuca', city: 'Rio de Janeiro', state: 'RJ', whatsapp: '5521900000011' },
    { code: 'RJ03', name: 'Toque de Cor – Niterói', city: 'Niterói', state: 'RJ', whatsapp: '5521900000012' },
    { code: 'MG01', name: 'Toque de Cor – BH Centro', city: 'Belo Horizonte', state: 'MG', whatsapp: '5531900000013' },
    { code: 'MG02', name: 'Toque de Cor – Contagem', city: 'Contagem', state: 'MG', whatsapp: '5531900000014' },
    { code: 'PR01', name: 'Toque de Cor – Curitiba', city: 'Curitiba', state: 'PR', whatsapp: '5541900000015' },
    { code: 'RS01', name: 'Toque de Cor – Porto Alegre', city: 'Porto Alegre', state: 'RS', whatsapp: '5551900000016' },
    { code: 'SC01', name: 'Toque de Cor – Florianópolis', city: 'Florianópolis', state: 'SC', whatsapp: '5548900000017' },
    { code: 'BA01', name: 'Toque de Cor – Salvador', city: 'Salvador', state: 'BA', whatsapp: '5571900000018' },
  ];

  const stores: { [key: string]: string } = {};
  for (const s of storeData) {
    const store = await prisma.store.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: s.code } },
      update: {},
      create: { tenantId: tenant.id, ...s },
    });
    stores[s.code] = store.id;
  }
  console.log(`✅ ${storeData.length} lojas criadas`);

  // ── Usuário Super Admin ───────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@2024!', 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@toquedeor.com.br' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Administrador',
      email: 'admin@toquedeor.com.br',
      passwordHash,
      role: UserRole.TENANT_ADMIN,
    },
  });

  // Vendedor demo na loja SP01
  const sellerHash = await bcrypt.hash('Vendedor@2024!', 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'vendedor@toquedeor.com.br' } },
    update: {},
    create: {
      tenantId: tenant.id,
      storeId: stores['SP01'],
      name: 'Carlos Vendedor',
      email: 'vendedor@toquedeor.com.br',
      passwordHash: sellerHash,
      role: UserRole.SELLER,
    },
  });
  console.log('✅ Usuários criados');

  // ── Categorias de produtos ────────────────────────────────────
  const categoryData = [
    { name: 'Tintas Imobiliárias', slug: 'tintas-imobiliarias', icon: '🎨', order: 1 },
    { name: 'Tintas para Madeira', slug: 'tintas-madeira', icon: '🪵', order: 2 },
    { name: 'Tintas para Metal', slug: 'tintas-metal', icon: '⚙️', order: 3 },
    { name: 'Tintas para Piso', slug: 'tintas-piso', icon: '🏠', order: 4 },
    { name: 'Impermeabilizantes', slug: 'impermeabilizantes', icon: '💧', order: 5 },
    { name: 'Massa Corrida e Seladores', slug: 'massa-seladores', icon: '🪣', order: 6 },
    { name: 'Primers e Fundos', slug: 'primers-fundos', icon: '🖌️', order: 7 },
    { name: 'Vernizes e Stains', slug: 'vernizes-stains', icon: '✨', order: 8 },
    { name: 'Texturas e Grafiatos', slug: 'texturas-grafiatos', icon: '🧱', order: 9 },
    { name: 'Acessórios', slug: 'acessorios', icon: '🛠️', order: 10 },
  ];

  const categories: { [key: string]: string } = {};
  for (const c of categoryData) {
    const cat = await prisma.category.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: c.slug } },
      update: {},
      create: { tenantId: tenant.id, ...c },
    });
    categories[c.slug] = cat.id;
  }
  console.log('✅ Categorias criadas');

  // ── Marcas ────────────────────────────────────────────────────
  const brandData = ['Suvinil', 'Coral', 'Sherwin-Williams', 'Tintas MC', 'Eucatex', 'Hidracor', 'Novacor'];
  const brands: { [key: string]: string } = {};
  for (const b of brandData) {
    const brand = await prisma.brand.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: b } },
      update: {},
      create: { tenantId: tenant.id, name: b },
    });
    brands[b] = brand.id;
  }
  console.log('✅ Marcas criadas');

  // ── Produtos ──────────────────────────────────────────────────
  const products = [
    {
      sku: 'TIN-SUV-ACRIL-3.6L',
      name: 'Suvinil Acrílico Premium 3.6L',
      categoryId: categories['tintas-imobiliarias'],
      brandId: brands['Suvinil'],
      description: 'Tinta acrílica premium para interiores e exteriores. Excelente cobertura, lavável e resistente.',
      technicalData: 'Base água, secagem ao toque: 30min, repintura: 4h, rendimento: 13m²/L por demão',
      surfaces: ['parede', 'teto'],
      environments: ['interno', 'externo'],
      finishes: ['fosco', 'acetinado', 'brilhante'],
      coverage: 13.0,
      dryTime: '30 minutos ao toque, 4 horas para repintura',
      coats: 2,
      dilution: 'Até 20% de água',
      price: 89.9,
      priceUnit: 'L',
      availableSizes: [{ size: '3.6L', price: 89.9 }, { size: '18L', price: 389.9 }],
      stock: 150,
      tags: ['premium', 'lavável', 'acrílica', 'interno', 'externo'],
    },
    {
      sku: 'TIN-COR-LATEX-18L',
      name: 'Coral Clássico Látex 18L',
      categoryId: categories['tintas-imobiliarias'],
      brandId: brands['Coral'],
      description: 'Tinta látex econômica para interiores. Boa cobertura e fácil aplicação.',
      technicalData: 'Base água, secagem 1h, rendimento: 10m²/L',
      surfaces: ['parede', 'teto'],
      environments: ['interno'],
      finishes: ['fosco'],
      coverage: 10.0,
      dryTime: '1 hora ao toque, 3 horas para repintura',
      coats: 2,
      dilution: 'Até 30% de água',
      price: 199.9,
      priceUnit: 'L',
      availableSizes: [{ size: '3.6L', price: 49.9 }, { size: '18L', price: 199.9 }],
      stock: 200,
      tags: ['econômica', 'látex', 'interno'],
    },
    {
      sku: 'TIN-SUV-ESMALTE-0.9L',
      name: 'Suvinil Esmalte Sintético Brilhante 0.9L',
      categoryId: categories['tintas-madeira'],
      brandId: brands['Suvinil'],
      description: 'Esmalte sintético para madeiras e metais. Alta resistência e acabamento brilhante.',
      technicalData: 'Base solvente, secagem 6h, rendimento: 14m²/L',
      surfaces: ['madeira', 'metal', 'ferro'],
      environments: ['interno', 'externo'],
      finishes: ['brilhante'],
      coverage: 14.0,
      dryTime: '6 horas ao toque, 24 horas para repintura',
      coats: 2,
      dilution: 'Thinner até 10%',
      price: 45.9,
      priceUnit: 'L',
      availableSizes: [{ size: '0.9L', price: 45.9 }, { size: '3.6L', price: 149.9 }],
      stock: 80,
      tags: ['esmalte', 'madeira', 'metal', 'brilhante'],
    },
    {
      sku: 'IMP-HIDRA-MANTA-18L',
      name: 'Hidracor Impermeabilizante Manta Líquida 18L',
      categoryId: categories['impermeabilizantes'],
      brandId: brands['Hidracor'],
      description: 'Impermeabilizante elastomérico para lajes, calhas e telhados. Altamente flexível.',
      technicalData: 'Base acrílica, 2 demãos, rendimento: 2m²/L por demão',
      surfaces: ['laje', 'telhado', 'calha', 'varanda'],
      environments: ['externo'],
      finishes: ['fosco'],
      coverage: 2.0,
      dryTime: '2 horas entre demãos, 48h para cura total',
      coats: 2,
      dilution: 'Não diluir',
      price: 249.9,
      priceUnit: 'L',
      availableSizes: [{ size: '3.6L', price: 59.9 }, { size: '18L', price: 249.9 }],
      stock: 60,
      tags: ['impermeabilizante', 'laje', 'telhado', 'externo'],
    },
    {
      sku: 'MAS-SUV-CORRIDA-25KG',
      name: 'Suvinil Massa Corrida PVA 25kg',
      categoryId: categories['massa-seladores'],
      brandId: brands['Suvinil'],
      description: 'Massa corrida para preparação de superfícies internas. Proporciona acabamento liso.',
      technicalData: 'PVA, rendimento: 25m²/kg em 2 demãos',
      surfaces: ['parede', 'teto'],
      environments: ['interno'],
      finishes: ['liso'],
      coverage: 25.0,
      dryTime: '4 horas entre demãos',
      coats: 2,
      dilution: 'Não diluir',
      price: 89.9,
      priceUnit: 'kg',
      availableSizes: [{ size: '25kg', price: 89.9 }],
      stock: 120,
      tags: ['massa corrida', 'PVA', 'preparação', 'interno'],
    },
    {
      sku: 'SEL-COR-FUNDO-18L',
      name: 'Coral Fundo Preparador 18L',
      categoryId: categories['primers-fundos'],
      brandId: brands['Coral'],
      description: 'Selador e preparador de superfícies para melhorar a aderência da tinta.',
      technicalData: 'Base água, rendimento: 16m²/L',
      surfaces: ['parede', 'teto', 'madeira'],
      environments: ['interno', 'externo'],
      finishes: ['fosco'],
      coverage: 16.0,
      dryTime: '2 horas',
      coats: 1,
      dilution: 'Até 10% de água',
      price: 179.9,
      priceUnit: 'L',
      availableSizes: [{ size: '3.6L', price: 44.9 }, { size: '18L', price: 179.9 }],
      stock: 90,
      tags: ['primer', 'selador', 'fundo preparador'],
    },
    {
      sku: 'TEX-COR-GRAFIATO-25KG',
      name: 'Coral Grafiato Textura 25kg',
      categoryId: categories['texturas-grafiatos'],
      brandId: brands['Coral'],
      description: 'Textura para fachadas e interiores. Resistente a intempéries e fungos.',
      technicalData: 'Acrílica, rendimento: 1-1.5m²/kg dependendo da espessura',
      surfaces: ['parede', 'fachada'],
      environments: ['interno', 'externo'],
      finishes: ['texturizado'],
      coverage: 1.2,
      dryTime: '6 horas',
      coats: 1,
      dilution: 'Não diluir',
      price: 129.9,
      priceUnit: 'kg',
      availableSizes: [{ size: '25kg', price: 129.9 }],
      stock: 70,
      tags: ['textura', 'grafiato', 'fachada', 'externo'],
    },
    {
      sku: 'TIN-SUV-PISO-3.6L',
      name: 'Suvinil Piso 3.6L',
      categoryId: categories['tintas-piso'],
      brandId: brands['Suvinil'],
      description: 'Tinta especial para pisos de concreto, madeira e cerâmica. Alta resistência ao pisoteio.',
      technicalData: 'Acrílica, rendimento: 12m²/L',
      surfaces: ['piso', 'concreto', 'cerâmica'],
      environments: ['interno', 'externo'],
      finishes: ['brilhante', 'acetinado'],
      coverage: 12.0,
      dryTime: '1 hora ao toque, 12 horas para tráfego leve',
      coats: 2,
      dilution: 'Até 15% de água',
      price: 109.9,
      priceUnit: 'L',
      availableSizes: [{ size: '3.6L', price: 109.9 }, { size: '18L', price: 479.9 }],
      stock: 55,
      tags: ['piso', 'concreto', 'resistente'],
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: p.sku } },
      update: {},
      create: {
        tenantId: tenant.id,
        ...p,
        isFeatured: ['TIN-SUV-ACRIL-3.6L', 'IMP-HIDRA-MANTA-18L'].includes(p.sku),
      },
    });
  }
  console.log(`✅ ${products.length} produtos criados`);

  // ── Configuração IA ────────────────────────────────────────────
  await prisma.aIConfig.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 1000,
      welcomeMessage:
        'Olá! 👋 Sou o **Tintor**, assistente virtual da *Toque de Cor*! Estou aqui para te ajudar a escolher as melhores tintas para o seu projeto. Como posso te ajudar hoje?',
      transferMessage:
        '✅ Pronto! Transferi você para um de nossos consultores especializados. Eles têm todo o contexto da nossa conversa e vão te atender em instantes! 😊',
    },
  });
  console.log('✅ Configuração de IA criada');

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('📧 Admin: admin@toquedeor.com.br | Senha: Admin@2024!');
  console.log('📧 Vendedor: vendedor@toquedeor.com.br | Senha: Vendedor@2024!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
