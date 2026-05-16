import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { InterfaceLanguage } from "@/translations";

const options: Array<{ code: InterfaceLanguage; label: string }> = [
  { code: "bangla", label: "🇧🇩 বাংলা" },
  { code: "english", label: "🇬🇧 EN" },
];

const activeStyle: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: "6px",
  border: "1.5px solid #F5A623",
  backgroundColor: "#F5A623",
  color: "#1A2E4A",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 700,
  transition: "all 0.2s",
};

const inactiveStyle: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: "6px",
  border: "1.5px solid rgba(255, 255, 255, 0.5)",
  backgroundColor: "transparent",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 400,
  transition: "all 0.2s",
};

const inactiveHoverStyle: React.CSSProperties = {
  ...inactiveStyle,
  border: "1.5px solid #F5A623",
  color: "#F5A623",
};

export default function NavbarLanguageSwitcher() {
  const { language, changeLanguage } = useLanguage();
  const [hovered, setHovered] = useState<InterfaceLanguage | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Interface language">
      {options.map((option) => {
        const isActive = language === option.code;
        const isHovered = hovered === option.code;
        const style = isActive
          ? activeStyle
          : isHovered
            ? inactiveHoverStyle
            : inactiveStyle;
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => void changeLanguage(option.code)}
            onMouseEnter={() => setHovered(option.code)}
            onMouseLeave={() => setHovered(null)}
            style={style}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
