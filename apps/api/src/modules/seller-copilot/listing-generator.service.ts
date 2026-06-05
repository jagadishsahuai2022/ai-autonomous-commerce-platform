/**
 * Listing Generator Service
 * AI-powered automatic product listing generation
 */

import { Injectable, Logger } from '@nestjs/common';
import { LoggerService } from '../../common/logger.service';
import { KafkaService } from '../../kafka/kafka.service';
import { GenerateListingDto, GeneratedListingResponseDto } from './dto/seller.dto';

@Injectable()
export class ListingGeneratorService {
  private readonly logger = new Logger('ListingGeneratorService');
  private readonly appLogger = new LoggerService();

  constructor(private readonly kafka: KafkaService) {}

  /**
   * Generate product listing using AI
   * Creates professional description, bullet points, and pricing guidance
   */
  async generateListing(
    userId: number,
    generateDto: GenerateListingDto
  ): Promise<GeneratedListingResponseDto> {
    try {
      this.appLogger.log('Generating listing', {
        userId,
        productTitle: generateDto.title,
        category: generateDto.category,
      });

      // Step 1: Enhance title
      const enhancedTitle = this.enhanceTitle(
        generateDto.title,
        generateDto.category,
        generateDto.subCategory,
        generateDto.keywords
      );

      // Step 2: Generate description
      const description = this.generateDescription(
        generateDto.title,
        generateDto.basicDescription,
        generateDto.category,
        generateDto.keywords
      );

      // Step 3: Generate bullet points
      const bulletPoints = this.generateBulletPoints(
        generateDto.title,
        description,
        generateDto.category
      );

      // Step 4: Suggest pricing
      const suggestedPrice = this.calculateSuggestedPrice(
        generateDto.basePrice,
        generateDto.costPrice,
        generateDto.category
      );

      // Step 5: Calculate listing quality score
      const listingScore = this.calculateListingScore(
        enhancedTitle,
        description,
        bulletPoints,
        generateDto.images?.length ?? 0
      );

      // Step 6: Generate keywords
      const keywords = this.extractKeywords(enhancedTitle, description, bulletPoints);

      const response: GeneratedListingResponseDto = {
        title: enhancedTitle,
        generatedDescription: description,
        bulletPoints,
        suggestedPrice,
        basePrice: generateDto.basePrice,
        category: generateDto.category,
        listingScore,
        recommendations: {
          titleTip: this.generateTitleTip(enhancedTitle, generateDto.keywords),
          descriptionTip: this.generateDescriptionTip(description),
          priceTip: `Suggested price ${suggestedPrice} could increase conversions by optimizing for market demand`,
          keywordsTip: `Include keywords: ${keywords.slice(0, 3).join(', ')} for better visibility`,
        },
        generatedMetadata: {
          keywords,
          tone: 'professional',
          focusAreas: this.determineFocusAreas(generateDto.category),
        },
      };

      // Emit event
      await this.kafka.emit('seller-events', {
        type: 'listing.generated',
        userId,
        title: enhancedTitle,
        listingScore,
        suggestedPrice,
        timestamp: new Date(),
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to generate listing', (error as any).message);
      throw new Error('Listing generation failed');
    }
  }

  /**
   * Enhance product title for better SEO and clarity
   */
  private enhanceTitle(
    baseTitle: string,
    category: string,
    subCategory?: string,
    keywords?: string[]
  ): string {
    // Remove common filler words
    let enhanced = baseTitle
      .replace(/\b(the|a|an|and)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 80);

    // Add category context if missing
    if (!enhanced.toLowerCase().includes(category.toLowerCase())) {
      enhanced = `${enhanced} - ${category}`;
    }

    // Add key keywords if provided
    if (keywords && keywords.length > 0) {
      const keyword = keywords[0];
      if (!enhanced.toLowerCase().includes(keyword.toLowerCase())) {
        enhanced = `${keyword} ${enhanced}`;
      }
    }

    return enhanced;
  }

  /**
   * Generate professional product description
   */
  private generateDescription(
    title: string,
    basicDescription: string | undefined,
    category: string,
    keywords?: string[]
  ): string {
    let description = `High-quality ${category} - ${title}.\n\n`;

    if (basicDescription) {
      description += `${basicDescription}\n\n`;
    }

    // Generate category-specific description
    const categoryDescriptions: Record<string, string> = {
      electronics: `Perfect for everyday use and professional applications. Features modern design and reliable performance. Backed by manufacturer warranty.`,
      fashion: `Stylish and comfortable piece that complements any wardrobe. Made with premium materials for durability and style.`,
      books: `Well-written and informative. Great for readers of all levels. Includes detailed content and valuable insights.`,
      home: `Enhance your living space with this functional and stylish item. Made with quality materials for long-lasting use.`,
    };

    const categoryKey = Object.keys(categoryDescriptions).find((key) =>
      category.toLowerCase().includes(key)
    );

    if (categoryKey) {
      description += categoryDescriptions[categoryKey] + '\n\n';
    }

    description += 'Check our store for more items. Fast shipping and secure packaging guaranteed.';

    return description;
  }

  /**
   * Generate SEO-optimized bullet points
   */
  private generateBulletPoints(title: string, description: string, category: string): string[] {
    const points: string[] = [];

    // Add quality indicators
    points.push('✓ Premium quality product');
    points.push('✓ Fast and secure shipping');

    // Category-specific points
    if (category.toLowerCase().includes('electronics')) {
      points.push('✓ Latest technology and features');
      (points.push('✓ Warranty coverage included'), points.push('✓ Expert technical support'));
    } else if (category.toLowerCase().includes('fashion')) {
      points.push('✓ Trending style and design');
      points.push('✓ Comfortable and durable');
      points.push('✓ Perfect for any occasion');
    } else if (category.toLowerCase().includes('home')) {
      points.push('✓ Enhances your home decor');
      points.push('✓ Functional and aesthetic');
      points.push('✓ Easy to install and use');
    } else {
      points.push('✓ Excellent value for money');
      points.push('✓ Trusted by customers');
      points.push('✓ Easy returns and exchanges');
    }

    return points;
  }

  /**
   * Calculate suggested selling price
   */
  private calculateSuggestedPrice(
    basePrice: number,
    costPrice: number | undefined,
    category: string
  ): number {
    if (!costPrice) {
      // If no cost price, apply category markup
      const markups: Record<string, number> = {
        electronics: 1.35,
        fashion: 1.5,
        books: 1.3,
        home: 1.4,
      };

      const markup = markups[category.toLowerCase()] || 1.4;
      return Math.round(basePrice * markup);
    }

    // Calculate suggested price based on cost with target margin
    const targetMargin = 0.4; // 40% margin
    const suggestedPrice = costPrice * (1 + targetMargin);

    // Round to nearest 99 for psychological pricing
    return Math.round(suggestedPrice / 100) * 100 - 1;
  }

  /**
   * Calculate listing quality score (0-100)
   */
  private calculateListingScore(
    title: string,
    description: string,
    bulletPoints: string[],
    imageCount: number
  ): number {
    let score = 0;

    // Title quality (0-20)
    if (title.length >= 50) score += 10;
    if (title.length >= 70) score += 10;

    // Description quality (0-40)
    if (description.length >= 100) score += 10;
    if (description.length >= 300) score += 10;
    if (description.includes('✓') || description.includes('•')) score += 5;
    if ((description.match(/\n/g) || []).length >= 2) score += 15;

    // Bullet points (0-20)
    if (bulletPoints.length >= 3) score += 10;
    if (bulletPoints.length >= 5) score += 10;

    // Images (0-20)
    if (imageCount >= 1) score += 5;
    if (imageCount >= 3) score += 10;
    if (imageCount >= 5) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Extract SEO keywords from content
   */
  private extractKeywords(title: string, description: string, bulletPoints: string[]): string[] {
    const content = `${title} ${description} ${bulletPoints.join(' ')}`.toLowerCase();

    // Common high-value keywords
    const potentialKeywords = [
      'premium',
      'quality',
      'fast shipping',
      'sale',
      'new',
      'best',
      'original',
      'authentic',
      'warranty',
      'home delivery',
      'cash on delivery',
      'returns accepted',
      'trusted seller',
    ];

    return potentialKeywords.filter((kw) => content.includes(kw));
  }

  /**
   * Generate title improvement tip
   */
  private generateTitleTip(title: string, keywords?: string[]): string {
    if (title.length < 50) {
      return 'Title is quite short. Add more descriptive words for better visibility';
    }
    return 'Title is well-optimized for search visibility';
  }

  /**
   * Generate description improvement tip
   */
  private generateDescriptionTip(description: string): string {
    if (description.length < 200) {
      return 'Description could be more detailed to help customers understand the product better';
    }
    if (description.length < 500) {
      return 'Good description. Consider adding more details about features and benefits';
    }
    return 'Description is comprehensive and well-written';
  }

  /**
   * Determine focus areas for category
   */
  private determineFocusAreas(category: string): string[] {
    const focusAreasMap: Record<string, string[]> = {
      electronics: ['Technology', 'Features', 'Specifications', 'Warranty'],
      fashion: ['Style', 'Comfort', 'Material', 'Size Guide'],
      books: ['Author', 'Genre', 'Content', 'Reviews'],
      home: ['Design', 'Functionality', 'Durability', 'Installation'],
    };

    const categoryKey = Object.keys(focusAreasMap).find((key) =>
      category.toLowerCase().includes(key)
    );
    return focusAreasMap[categoryKey || 'general'] || ['Quality', 'Value', 'Support'];
  }
}
