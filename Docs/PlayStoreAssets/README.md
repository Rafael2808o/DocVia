# Materiais da Google Play — DocVia

O ícone foi aprovado por Rafael em 7 de agosto de 2026 e aplicado ao app. O script desta pasta gera novamente os assets mobile e as dimensões exigidas pela Play Store.

- `icon-candidate.png`: fonte aprovada do ícone sem texto (1254 × 1254).
- `feature-graphic-candidate.png`: proposta de banner (fonte em 1794 × 876). Depois da aprovação visual, exporte a versão final exatamente em 1024 × 500.
- `play-icon-512.png`: ícone final da ficha, 512 × 512 e abaixo de 1 MB.
- `feature-graphic-1024x500.png`: banner exportado na dimensão exigida; a composição ainda deve ser aprovada antes do envio.
- `generate-assets.ps1`: exporta ícone, foreground adaptativo, fundo, monochrome, splash, favicon e materiais da loja.

As variantes foram verificadas após `expo prebuild`; o Android gerou launcher adaptativo, versão monocromática e splash sobre fundo `#08080F`.
