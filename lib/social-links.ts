export interface SocialLink {
  id: string
  label: string
  href: string
}

export const socialLinks: SocialLink[] = [
  { id: 'email', label: 'Email', href: 'mailto:5228sein@gmail.com' },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/sein-ines-kim/'
  },
  { id: 'github', label: 'GitHub', href: 'https://github.com/seineskim' },
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/sein.eskim/'
  }
]
