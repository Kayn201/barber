const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function seedDatabase() {
  try {
    // Limpar dados existentes
    await prisma.rating.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.professionalService.deleteMany();
    await prisma.weeklySchedule.deleteMany();
    await prisma.blockedDate.deleteMany();
    await prisma.professional.deleteMany();
    await prisma.barbershopService.deleteMany();
    await prisma.barbershop.deleteMany();

    const professionalImages = [
      "https://utfs.io/f/c97a2dc9-cf62-468b-a851-bfd2bdde775f-16p.png",
      "https://utfs.io/f/45331760-899c-4b4b-910e-e00babb6ed81-16q.png",
      "https://utfs.io/f/5832df58-cfd7-4b3f-b102-42b7e150ced2-16r.png",
      "https://utfs.io/f/7e309eaa-d722-465b-b8b6-76217404a3d3-16s.png",
      "https://utfs.io/f/178da6b6-6f9a-424a-be9d-a2feb476eb36-16t.png",
      "https://utfs.io/f/2f9278ba-3975-4026-af46-64af78864494-16u.png",
      "https://utfs.io/f/988646ea-dcb6-4f47-8a03-8d4586b7bc21-16v.png",
      "https://utfs.io/f/60f24f5c-9ed3-40ba-8c92-0cd1dcd043f9-16w.png",
    ];

    const professionalNames = [
      { name: "Carlos Silva", profession: "Barbeiro Master" },
      { name: "João Santos", profession: "Especialista em Barba" },
      { name: "Pedro Oliveira", profession: "Barbeiro Clássico" },
      { name: "Lucas Costa", profession: "Estilista Capilar" },
      { name: "Rafael Alves", profession: "Barbeiro Moderno" },
      { name: "Felipe Martins", profession: "Especialista em Fade" },
      { name: "Bruno Rodrigues", profession: "Barbeiro Premium" },
      { name: "Gabriel Lima", profession: "Barbeiro Executivo" },
    ];

    // Criar uma única barbearia
    const barbershop = await prisma.barbershop.create({
      data: {
        name: "FSW Barber",
        address: "Rua da Barbearia, 123 - São Paulo, SP",
        imageUrl: professionalImages[0],
        phones: ["(11) 99999-9999"],
        description:
          "A melhor barbearia da cidade. Oferecemos serviços de alta qualidade com profissionais experientes.",
      },
    });

    // Criar serviços
    const services = [
      {
        name: "Corte de Cabelo",
        description: "Estilo personalizado com as últimas tendências.",
        price: 60.0,
        duration: 30,
        imageUrl:
          "https://utfs.io/f/0ddfbd26-a424-43a0-aaf3-c3f1dc6be6d1-1kgxo7.png",
      },
      {
        name: "Barba",
        description: "Modelagem completa para destacar sua masculinidade.",
        price: 40.0,
        duration: 20,
        imageUrl:
          "https://utfs.io/f/e6bdffb6-24a9-455b-aba3-903c2c2b5bde-1jo6tu.png",
      },
      {
        name: "Corte + Barba",
        description: "Pacote completo de corte e barba.",
        price: 90.0,
        duration: 50,
        imageUrl:
          "https://utfs.io/f/8a457cda-f768-411d-a737-cdb23ca6b9b5-b3pegf.png",
      },
      {
        name: "Sobrancelha",
        description: "Expressão acentuada com modelagem precisa.",
        price: 20.0,
        duration: 15,
        imageUrl:
          "https://utfs.io/f/2118f76e-89e4-43e6-87c9-8f157500c333-b0ps0b.png",
      },
    ];

    const createdServices = [];
    for (const service of services) {
      const created = await prisma.barbershopService.create({
        data: {
          name: service.name,
          description: service.description,
          price: service.price,
          duration: service.duration,
          imageUrl: service.imageUrl,
        },
      });
      createdServices.push(created);
    }

    // Criar profissionais
    const professionals = [];
    for (let i = 0; i < professionalNames.length; i++) {
      const prof = await prisma.professional.create({
        data: {
          name: professionalNames[i].name,
          profession: professionalNames[i].profession,
          imageUrl: professionalImages[i],
        },
      });
      professionals.push(prof);

      // Criar agenda semanal (Segunda a Sábado, 8h às 18h)
      const daysOfWeek = [1, 2, 3, 4, 5, 6]; // Segunda a Sábado
      for (const day of daysOfWeek) {
        await prisma.weeklySchedule.create({
          data: {
            professionalId: prof.id,
            dayOfWeek: day,
            startTime: "08:00",
            endTime: "18:00",
            isAvailable: true,
          },
        });
      }

      // Vincular todos os serviços a cada profissional
      for (const service of createdServices) {
        await prisma.professionalService.create({
          data: {
            professionalId: prof.id,
            serviceId: service.id,
          },
        });
      }
    }

    console.log("✅ Seed concluído com sucesso!");
    console.log(`📊 Criados:`);
    console.log(`   - 1 Barbearia`);
    console.log(`   - ${createdServices.length} Serviços`);
    console.log(`   - ${professionals.length} Profissionais`);
    console.log(`   - ${professionals.length * createdServices.length} Vínculos Profissional-Serviço`);

    // Fechar a conexão com o banco de dados
    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Erro ao criar os dados:", error);
    throw error;
  }
}

seedDatabase()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
