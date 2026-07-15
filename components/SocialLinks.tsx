import * as React from 'react'

import { GitHubIcon } from '@/lib/icons/github'
import { InstagramIcon } from '@/lib/icons/instagram'
import { LinkedInIcon } from '@/lib/icons/linkedin'
import { MailIcon } from '@/lib/icons/mail'
import { type SocialLink, socialLinks } from '@/lib/social-links'

import styles from './SocialLinks.module.css'

const icons: Record<string, React.ComponentType> = {
  email: MailIcon,
  linkedin: LinkedInIcon,
  github: GitHubIcon,
  instagram: InstagramIcon
}

export function SocialLinks() {
  return (
    <div className={styles.row}>
      {socialLinks.map((link: SocialLink) => {
        const Icon = icons[link.id]
        const isExternal = !link.href.startsWith('mailto:')

        return (
          <a
            key={link.id}
            href={link.href}
            aria-label={link.label}
            title={link.label}
            className={styles.icon}
            {...(isExternal
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : null)}
          >
            <Icon />
          </a>
        )
      })}
    </div>
  )
}
