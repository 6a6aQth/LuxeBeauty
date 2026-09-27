const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Category metadata from your existing setup
const categoryMetadata = {
  manicure: {
    description: "Our manicure services are designed to enhance the natural beauty of your hands while ensuring nail health and longevity.",
    imageUrl: "/images/nails-1.jpeg",
  },
  pedicure: {
    description: "Pamper your feet with our luxurious pedicure treatments that combine relaxation with expert nail care.",
    imageUrl: "/images/nails-8.jpeg",
  },
  refills: {
    description: "Maintain your beautiful nails with our professional refill services, extending the life of your manicure.",
    imageUrl: "/images/nails-4.jpeg",
  },
  'nail-art': {
    description: "Express your personality with our creative nail art options, from subtle elegance to bold statements.",
    imageUrl: "/images/nails-5.jpeg",
  },
  'soak-off': {
    description: "Our gentle soak-off services ensure safe removal of previous applications without damaging your natural nails.",
    imageUrl: "/images/nails-7.jpeg",
  },
};

// Helper to create slug from category name
function createSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function main() {
  console.log('Starting category migration...');

  try {
    // Get all unique category strings from existing services
    const services = await prisma.service.findMany({
      select: {
        category: true,
      },
      distinct: ['category'],
    });

    const uniqueCategories = services
      .map((s) => s.category)
      .filter((cat) => cat && cat.trim() !== '');

    console.log(`Found ${uniqueCategories.length} unique categories:`, uniqueCategories);

    if (uniqueCategories.length === 0) {
      console.log('No categories found in services. Nothing to migrate.');
      return;
    }

    // Create Category records for each unique category
    let created = 0;
    let skipped = 0;

    for (const categoryName of uniqueCategories) {
      const slug = createSlug(categoryName);
      
      // Check if category already exists
      const existing = await prisma.category.findUnique({
        where: { slug },
      });

      if (existing) {
        console.log(`Category "${categoryName}" (slug: ${slug}) already exists. Skipping.`);
        skipped++;
        continue;
      }

      // Get metadata if available
      const metadata = categoryMetadata[categoryName] || {};
      
      const category = await prisma.category.create({
        data: {
          name: categoryName,
          slug: slug,
          description: metadata.description || null,
          imageUrl: metadata.imageUrl || null,
        },
      });

      console.log(`Created category: "${categoryName}" (slug: ${slug}, id: ${category.id})`);
      created++;
    }

    console.log(`\nMigration complete!`);
    console.log(`- Created: ${created} categories`);
    console.log(`- Skipped: ${skipped} categories (already exist)`);
    console.log(`\nYour existing services are now linked to these categories.`);
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

