export const siteConfig = {
  controller: process.env.NEXT_PUBLIC_CONTROLLER_NAME || "Rafael de Oliveira Silva",
  email: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "zrafaelxd07@gmail.com",
  updatedAt: "7 de agosto de 2026",
};

export const hasPendingLegalIdentity = siteConfig.controller.startsWith("[") || siteConfig.email.startsWith("[");
