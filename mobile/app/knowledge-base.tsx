// mobile/app/knowledge-base.tsx
// FE-15: Knowledge Base — search, categories, article list, article detail
// Navigated to from Settings. Article detail opens inline via state (no extra route needed).

import React, { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  STATIC_CATEGORIES,
  STATIC_ARTICLES,
  type KBCategory,
  type KBArticle,
} from "@/hooks/useKnowledgeBase";

const C = {
  bg:           "#f3faff",
  surface:      "#ffffff",
  primary:      "#000b25",
  mid:          "#44474e",
  muted:        "#75777f",
  border:       "#c5c6cf",
  borderSoft:   "#e6f6ff",
  container:    "#dbf1fe",
  containerLow: "#e6f6ff",
  secondary:    "#2a6b2c",
  secondaryBg:  "#acf4a4",
  burs:         "#1A3C5E",
  bursBg:       "#EAF0F7",
  cipa:         "#2E6B4F",
  cipaBg:       "#E8F4EE",
  labour:       "#6B3A7D",
  labourBg:     "#F3EEF7",
  amber:        "#D4830A",
  amberBg:      "#FEF3E2",
};

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  burs:   { bg: C.bursBg,   text: C.burs   },
  cipa:   { bg: C.cipaBg,   text: C.cipa   },
  labour: { bg: C.labourBg, text: C.labour },
  vat:    { bg: C.amberBg,  text: C.amber  },
  tips:   { bg: C.secondaryBg, text: C.secondary },
};
const catColor = (id: string) => CAT_COLORS[id] ?? { bg: C.borderSoft, text: C.mid };

// ── Markdown-lite renderer ────────────────────────────────────────────────────
// Renders headings, bold, bullets, and horizontal rules from article content
function MarkdownBlock({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <View style={md.wrap}>
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return <Text key={i} style={md.h2}>{line.slice(3)}</Text>;
        }
        if (line.startsWith("| ")) {
          // Simple table row — render as a row of text
          const cells = line.split("|").filter((c) => c.trim() && c.trim() !== "---");
          return (
            <View key={i} style={md.tableRow}>
              {cells.map((c, j) => (
                <Text key={j} style={[md.tableCell, j === 0 && md.tableCellLabel]}>{c.trim()}</Text>
              ))}
            </View>
          );
        }
        if (line.startsWith("- ") || line.startsWith("1. ") || /^\d+\. /.test(line)) {
          const text = line.replace(/^[\-\d]+\.?\s+/, "");
          return (
            <View key={i} style={md.bulletRow}>
              <Text style={md.bullet}>•</Text>
              <Text style={md.bulletText}>{renderInline(text)}</Text>
            </View>
          );
        }
        if (line === "---" || line === "") {
          return <View key={i} style={line === "---" ? md.rule : md.spacer} />;
        }
        return <Text key={i} style={md.p}>{renderInline(line)}</Text>;
      })}
    </View>
  );
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <Text key={i} style={{ fontFamily: "PublicSans_700Bold" }}>{part.slice(2, -2)}</Text>;
    }
    return part;
  });
}

const md = StyleSheet.create({
  wrap:       { gap: 2 },
  h2:         { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary, marginTop: 16, marginBottom: 6 },
  p:          { fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.mid, lineHeight: 22 },
  bulletRow:  { flexDirection: "row", gap: 8, marginVertical: 2 },
  bullet:     { fontSize: 14, color: C.burs, marginTop: 2 },
  bulletText: { flex: 1, fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.mid, lineHeight: 22 },
  tableRow:   { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 6, gap: 8 },
  tableCell:  { flex: 1, fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.mid },
  tableCellLabel: { fontFamily: "PublicSans_600SemiBold", color: C.primary },
  rule:       { height: 1, backgroundColor: C.border, marginVertical: 12 },
  spacer:     { height: 6 },
});

// ── Category chip ─────────────────────────────────────────────────────────────
function CategoryCard({ cat, active, onPress }: { cat: KBCategory; active: boolean; onPress: () => void }) {
  const cc = catColor(cat.id);
  return (
    <Pressable style={({ pressed }) => [s.catCard, active && { borderColor: cc.text, backgroundColor: cc.bg }, pressed && { opacity: 0.75 }]} onPress={onPress}>
      <View style={[s.catIconWrap, { backgroundColor: active ? cc.bg : C.borderSoft }]}>
        <MaterialIcons name={cat.icon as any} size={22} color={active ? cc.text : C.muted} />
      </View>
      <Text style={[s.catLabel, active && { color: cc.text }]}>{cat.label}</Text>
      <Text style={s.catCount}>{cat.article_count}</Text>
    </Pressable>
  );
}

// ── Article row ───────────────────────────────────────────────────────────────
function ArticleRow({ article, onPress }: { article: KBArticle; onPress: () => void }) {
  const cc = catColor(article.category_id);
  return (
    <Pressable style={({ pressed }) => [s.articleRow, pressed && { opacity: 0.75 }]} onPress={onPress}>
      {article.is_pinned && (
        <View style={s.pinnedBadge}>
          <MaterialIcons name="push-pin" size={10} color={C.amber} />
          <Text style={s.pinnedText}>Featured</Text>
        </View>
      )}
      <View style={s.articleHeader}>
        <View style={[s.articleCatDot, { backgroundColor: cc.bg }]}>
          <Text style={[s.articleCatLabel, { color: cc.text }]}>{article.category_id.toUpperCase()}</Text>
        </View>
        <Text style={s.readingTime}>{article.reading_time_minutes} min read</Text>
      </View>
      <Text style={s.articleTitle} numberOfLines={2}>{article.title}</Text>
      <Text style={s.articleSummary} numberOfLines={2}>{article.summary}</Text>
      <View style={s.articleFooter}>
        <View style={s.tagsRow}>
          {article.tags.slice(0, 3).map((t) => (
            <View key={t} style={s.tag}><Text style={s.tagText}>{t}</Text></View>
          ))}
        </View>
        <MaterialIcons name="chevron-right" size={18} color={C.border} />
      </View>
    </Pressable>
  );
}

// ── Article detail view ───────────────────────────────────────────────────────
function ArticleDetail({ article, onBack }: { article: KBArticle; onBack: () => void }) {
  const cc = catColor(article.category_id);
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>Knowledge Base</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.detailContent} showsVerticalScrollIndicator={false}>
        {/* Article header */}
        <View style={[s.detailBanner, { backgroundColor: cc.bg }]}>
          <Text style={[s.detailCategory, { color: cc.text }]}>{article.category_id.toUpperCase()}</Text>
          <Text style={[s.detailTitle, { color: C.primary }]}>{article.title}</Text>
          <View style={s.detailMeta}>
            <MaterialIcons name="schedule" size={13} color={C.muted} />
            <Text style={s.detailMetaText}>{article.reading_time_minutes} min read</Text>
          </View>
        </View>

        {/* Body */}
        <View style={s.detailBody}>
          <MarkdownBlock content={article.content} />
        </View>

        {/* Tags */}
        <View style={[s.tagsRow, { marginTop: 20, flexWrap: "wrap", gap: 8 }]}>
          {article.tags.map((t) => (
            <View key={t} style={s.tag}><Text style={s.tagText}>{t}</Text></View>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function KnowledgeBaseScreen() {
  const [search,          setSearch]          = useState("");
  const [activeCatId,     setActiveCatId]     = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);

  const filtered = useMemo(() => {
    let articles = STATIC_ARTICLES;
    if (activeCatId) articles = articles.filter((a) => a.category_id === activeCatId);
    if (search.trim()) {
      const q = search.toLowerCase();
      articles = articles.filter(
        (a) => a.title.toLowerCase().includes(q) ||
               a.summary.toLowerCase().includes(q) ||
               a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    // Pinned first
    return [...articles].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
  }, [activeCatId, search]);

  if (selectedArticle) {
    return <ArticleDetail article={selectedArticle} onBack={() => setSelectedArticle(null)} />;
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <Text style={s.headerTitle}>Knowledge Base</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroTitle}>Compliance Guides</Text>
          <Text style={s.heroSub}>Plain-language guides to BURS, CIPA, Labour Act, and more.</Text>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <MaterialIcons name="search" size={19} color={C.muted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search articles…"
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <MaterialIcons name="close" size={17} color={C.muted} />
            </Pressable>
          )}
        </View>

        {/* Categories */}
        {!search && (
          <>
            <Text style={s.sectionLabel}>BROWSE BY CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
              <Pressable
                style={[s.catCard, activeCatId === null && { borderColor: C.burs, backgroundColor: C.bursBg }]}
                onPress={() => setActiveCatId(null)}
              >
                <View style={[s.catIconWrap, { backgroundColor: activeCatId === null ? C.bursBg : C.borderSoft }]}>
                  <MaterialIcons name="menu-book" size={22} color={activeCatId === null ? C.burs : C.muted} />
                </View>
                <Text style={[s.catLabel, activeCatId === null && { color: C.burs }]}>All</Text>
                <Text style={s.catCount}>{STATIC_ARTICLES.length}</Text>
              </Pressable>
              {STATIC_CATEGORIES.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  cat={cat}
                  active={activeCatId === cat.id}
                  onPress={() => setActiveCatId(activeCatId === cat.id ? null : cat.id)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* Articles */}
        <Text style={s.sectionLabel}>
          {search ? `RESULTS (${filtered.length})` : activeCatId ? `${activeCatId.toUpperCase()} (${filtered.length})` : `ALL ARTICLES (${filtered.length})`}
        </Text>

        {filtered.length === 0 ? (
          <View style={s.emptyBox}>
            <MaterialIcons name="search-off" size={44} color={C.border} />
            <Text style={s.emptyTitle}>No articles found</Text>
            <Text style={s.emptyDesc}>Try a different search term or browse a category.</Text>
          </View>
        ) : (
          filtered.map((article) => (
            <ArticleRow key={article.id} article={article} onPress={() => setSelectedArticle(article)} />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },

  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 56, paddingHorizontal: 16, backgroundColor: C.container, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:       { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle:   { flex: 1, fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary, textAlign: "center" },

  hero:          { paddingTop: 20, paddingBottom: 16 },
  heroTitle:     { fontSize: 24, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 6 },
  heroSub:       { fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 19 },

  searchWrap:    { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, height: 46, paddingHorizontal: 14, marginBottom: 20, gap: 10 },
  searchInput:   { flex: 1, fontSize: 14, fontFamily: "PublicSans_400Regular", color: C.primary },

  sectionLabel:  { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12, marginTop: 4 },

  catRow:        { gap: 10, paddingBottom: 20 },
  catCard:       { width: 100, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, alignItems: "center", gap: 6 },
  catIconWrap:   { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  catLabel:      { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: C.muted, textAlign: "center" },
  catCount:      { fontSize: 10, fontFamily: "PublicSans_400Regular", color: C.muted },

  articleRow:    { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 10 },
  pinnedBadge:   { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  pinnedText:    { fontSize: 10, fontFamily: "PublicSans_700Bold", color: C.amber, textTransform: "uppercase", letterSpacing: 0.5 },
  articleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  articleCatDot: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  articleCatLabel:{ fontSize: 9, fontFamily: "PublicSans_700Bold", letterSpacing: 0.5 },
  readingTime:   { fontSize: 11, fontFamily: "PublicSans_400Regular", color: C.muted },
  articleTitle:  { fontSize: 15, fontFamily: "PublicSans_700Bold", color: C.primary, marginBottom: 6, lineHeight: 21 },
  articleSummary:{ fontSize: 13, fontFamily: "PublicSans_400Regular", color: C.muted, lineHeight: 19, marginBottom: 12 },
  articleFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tagsRow:       { flexDirection: "row", gap: 6 },
  tag:           { backgroundColor: C.containerLow, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  tagText:       { fontSize: 10, fontFamily: "PublicSans_400Regular", color: C.burs },

  emptyBox:      { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle:    { fontSize: 16, fontFamily: "PublicSans_700Bold", color: C.primary },
  emptyDesc:     { fontSize: 13, color: C.muted, textAlign: "center", maxWidth: 240 },

  // Detail view
  detailContent: { paddingBottom: 32 },
  detailBanner:  { padding: 20, paddingBottom: 24, marginBottom: 4 },
  detailCategory:{ fontSize: 10, fontFamily: "PublicSans_700Bold", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  detailTitle:   { fontSize: 22, fontFamily: "PublicSans_700Bold", lineHeight: 30, marginBottom: 10 },
  detailMeta:    { flexDirection: "row", alignItems: "center", gap: 4 },
  detailMetaText:{ fontSize: 12, fontFamily: "PublicSans_400Regular", color: C.muted },
  detailBody:    { paddingHorizontal: 20, paddingTop: 20 },
});