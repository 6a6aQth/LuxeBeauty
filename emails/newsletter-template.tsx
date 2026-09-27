import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  render,
} from '@react-email/components';
import * as React from 'react';

interface NewsletterEmailProps {
  subject: string;
  content: string;
  unsubscribeUrl: string;
  baseUrl: string;
}

export const NewsletterEmail = ({ subject, content, unsubscribeUrl, baseUrl }: NewsletterEmailProps) => (
  <Html>
    <Head />
    <Preview>{subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoContainer}>
          <Text style={est}>ESTD — 2022</Text>
          <Text style={wordmark}>LAURYN</Text>
          <Text style={script}>luxe</Text>
          <Text style={studio}>BEAUTY STUDIO</Text>
        </Section>
        <Hr style={rule} />
        <Section style={contentSection}>
          <Text style={heading}>{subject}</Text>
          <Text style={paragraph}>{content}</Text>
        </Section>
        <Hr style={hr} />
        <Section style={footer}>
          <Text style={footerText}>
            Lauryn Luxe Beauty Studio · Blantyre
          </Text>
          <Text style={footerLink}>
            <a href={baseUrl} style={link}>Visit the studio</a>
          </Text>
          <Text style={footerLink}>
            Changed your mind? <a href={unsubscribeUrl} style={link}>Unsubscribe</a>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const renderNewsletterEmail = (props: NewsletterEmailProps) =>
  render(<NewsletterEmail {...props} />, {
    pretty: true,
  });

// Styles
const main = {
  backgroundColor: '#f6f3ef',
  fontFamily: "Georgia, 'Times New Roman', serif",
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0 0 28px',
  marginBottom: '32px',
  borderRadius: '28px',
  overflow: 'hidden' as const,
};

const logoContainer = {
  backgroundColor: '#0c0c0c',
  padding: '32px 24px 24px',
  textAlign: 'center' as const,
};

const est = {
  margin: '0',
  fontSize: '11px',
  letterSpacing: '0.42em',
  color: '#a8a29e',
}

const wordmark = {
  margin: '14px 0 0',
  fontSize: '28px',
  letterSpacing: '0.22em',
  color: '#f4f0ea',
}

const script = {
  margin: '0',
  fontSize: '34px',
  fontStyle: 'italic' as const,
  color: '#f4f0ea',
}

const studio = {
  margin: '6px 0 0',
  fontSize: '10px',
  letterSpacing: '0.38em',
  color: '#a8a29e',
}

const rule = {
  borderColor: '#f4c6d4',
  borderWidth: '2px',
  margin: '0',
}

const contentSection = {
  padding: '28px 32px 8px',
};

const heading = {
  fontSize: '28px',
  lineHeight: '1.2',
  color: '#1c1917',
  fontWeight: 'normal' as const,
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#44403c',
};

const hr = {
  borderColor: '#f3d0db',
  margin: '12px 32px 0',
};

const footer = {
  color: '#78716c',
  fontSize: '12px',
  lineHeight: '18px',
  textAlign: 'center' as const,
};

const footerText = {
  margin: '16px 0 4px 0',
  letterSpacing: '0.06em',
}

const footerLink = {
  margin: '0',
};

const link = {
  color: '#6e243f',
} 