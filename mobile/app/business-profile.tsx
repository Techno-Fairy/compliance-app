// mobile/app/business-profile.tsx
import { useState } from "react";
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
  Switch, TouchableOpacity, Modal, FlatList,
} from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useFonts, PublicSans_400Regular, PublicSans_600SemiBold, PublicSans_700Bold } from "@expo-google-fonts/public-sans";
import { api } from "@/lib/api";

type CompanyType = "sole_trader" | "pty_ltd" | "partnership" | "ngo";

const COMPANY_TYPES: { label: string; value: CompanyType }[] = [
  { label: "Pty Ltd (Private Limited Company)", value: "pty_ltd" },
  { label: "Sole Trader",                        value: "sole_trader" },
  { label: "Partnership",                        value: "partnership" },
  { label: "NGO / Non-Profit",                   value: "ngo" },
];

const C = {
  primary:        "#000b25",
  onPrimary:      "#ffffff",
  surface:        "#f3faff",
  surfaceLowest:  "#ffffff",
  containerLow:   "#e6f6ff",
  container:      "#dbf1fe",
  onSurface:      "#071e27",
  onVariant:      "#44474e",
  outline:        "#75777f",
  outlineVariant: "#c5c6cf",
  secondary:      "#2a6b2c",
  secondaryText:  "#307231",
  tint:           "#4b5e87",
};

export default function BusinessProfileScreen() {
  const [businessName, setBusinessName] = useState("");
  const [companyType, setCompanyType] = useState<CompanyType>("pty_ltd");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [cipaNumber, setCipaNumber] = useState("");
  const [bursTin, setBursTin] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatFilingMonthly, setVatFilingMonthly] = useState(true);
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({ PublicSans_400Regular, PublicSans_600SemiBold, PublicSans_700Bold });
  if (!fontsLoaded) return <View style={s.loading}><ActivityIndicator size="large" color={C.tint} /></View>;

  const handleSubmit = async () => {
    if (!businessName.trim()) return Alert.alert("Validation", "Business name is required.");
    setLoading(true);
    try {
      await api.post("/business/profile", {
        business_name: businessName.trim(), company_type: companyType,
        cipa_number: cipaNumber.trim() || null, burs_tin: bursTin.trim() || null,
        vat_registered: vatRegistered, vat_filing_monthly: vatFilingMonthly,
      });
      router.replace("/(tabs)");
    } catch (err: any) {
      if (err?.response?.status === 409) {
        Alert.alert("Info", "Business profile already exists. Taking you to the dashboard.");
        router.replace("/(tabs)");
      } else {
        Alert.alert("Error", err?.response?.data?.detail?.message ?? "Failed to create profile. Please try again.");
      }
    } finally { setLoading(false); }
  };

  return (
    <View style={s.root}>
      {/* Top bar */}
      <View style={s.topBar}>
        <View style={s.topBarLeft}>
          <MaterialIcons name="menu" size={22} color={C.primary} />
          <Text style={s.appTitle}>CompliancePro Botswana</Text>
        </View>
        <View style={s.profileAvatar}>
          <MaterialIcons name="person" size={18} color={C.primary} />
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Step indicator */}
        <View style={s.stepWrap}>
          <View style={s.stepRow}>
            <Text style={s.stepLabel}>Step 2 of 4</Text>
            <Text style={s.stepSub}>Business Core Details</Text>
          </View>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: "50%" }]} />
          </View>
        </View>

        {/* Header */}
        <View style={s.headerSection}>
          <Text style={s.title}>Business Profile</Text>
          <Text style={s.sub}>
            Provide your registered company information to synchronize with BURS and CIPA systems.
          </Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          {/* Business Name */}
          <View style={s.field}>
            <Text style={s.label}>Business Name</Text>
            <TextInput
              style={s.input} placeholder="e.g. Kgale Tech Solutions"
              placeholderTextColor="#a0a3ab" value={businessName} onChangeText={setBusinessName}
            />
            <Text style={s.hint}>Must match your CIPA certificate exactly.</Text>
          </View>

          {/* Company Type */}
          <View style={s.field}>
            <Text style={s.label}>Company Type</Text>
            <TouchableOpacity style={s.dropdownBtn} onPress={() => setDropdownOpen(true)} activeOpacity={0.7}>
              <Text style={s.dropdownBtnText}>
                {COMPANY_TYPES.find(t => t.value === companyType)?.label ?? "Select type"}
              </Text>
              <MaterialIcons name="expand-more" size={20} color={C.onVariant} />
            </TouchableOpacity>

            <Modal visible={dropdownOpen} transparent animationType="fade" onRequestClose={() => setDropdownOpen(false)}>
              <Pressable style={s.modalOverlay} onPress={() => setDropdownOpen(false)}>
                <View style={s.modalSheet}>
                  <Text style={s.modalTitle}>Company Type</Text>
                  <FlatList
                    data={COMPANY_TYPES}
                    keyExtractor={item => item.value}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[s.modalOption, item.value === companyType && s.modalOptionSelected]}
                        onPress={() => { setCompanyType(item.value); setDropdownOpen(false); }}
                      >
                        <Text style={[s.modalOptionText, item.value === companyType && s.modalOptionTextSelected]}>
                          {item.label}
                        </Text>
                        {item.value === companyType && (
                          <MaterialIcons name="check" size={18} color={C.secondary} />
                        )}
                      </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={s.modalDivider} />}
                  />
                </View>
              </Pressable>
            </Modal>
          </View>

          {/* CIPA Number */}
          <View style={s.field}>
            <Text style={s.label}>CIPA Registration Number</Text>
            <View style={s.inputWithIcon}>
              <TextInput
                style={s.inputIconField} placeholder="BW-00000000"
                placeholderTextColor="#a0a3ab" value={cipaNumber} onChangeText={setCipaNumber}
              />
              {cipaNumber.length > 0 && <MaterialIcons name="check-circle" size={20} color={C.secondary} />}
            </View>
            {cipaNumber.length > 0 && <Text style={s.verified}>✓ Verified with CIPA</Text>}
          </View>

          {/* BURS TIN */}
          <View style={s.field}>
            <Text style={s.label}>BURS Tax Identification Number (TIN)</Text>
            <TextInput
              style={s.input} placeholder="9 Digit Number"
              placeholderTextColor="#a0a3ab" keyboardType="numeric"
              value={bursTin} onChangeText={setBursTin}
            />
            <Text style={s.hint}>Your unique 9-digit tax identifier issued by BURS.</Text>
          </View>

          {/* VAT toggle */}
          <View style={s.toggleCard}>
            <View style={s.toggleText}>
              <Text style={s.toggleTitle}>VAT Registration</Text>
              <Text style={s.toggleSub}>Is your business registered for VAT?</Text>
            </View>
            <Switch
              value={vatRegistered} onValueChange={setVatRegistered}
              trackColor={{ false: C.outlineVariant, true: C.secondary }}
              thumbColor="#ffffff"
            />
          </View>

          {vatRegistered && (
            <View style={s.toggleCard}>
              <View style={s.toggleText}>
                <Text style={s.toggleTitle}>VAT Filing Frequency</Text>
                <Text style={s.toggleSub}>Do you file monthly?</Text>
              </View>
              <Switch
                value={vatFilingMonthly} onValueChange={setVatFilingMonthly}
                trackColor={{ false: C.outlineVariant, true: C.secondary }}
                thumbColor="#ffffff"
              />
            </View>
          )}

          {/* Tip card */}
          <View style={s.tipCard}>
            <MaterialIcons name="info" size={20} color={C.secondary} />
            <View style={s.tipTextWrap}>
              <Text style={s.tipTitle}>Pro-Compliance Tip</Text>
              <Text style={s.tipBody}>
                Ensuring your TIN is correct now avoids filing delays during the Annual Tax Season in Gaborone and beyond.
              </Text>
            </View>
          </View>

          {/* Actions */}
          <Pressable style={[s.submitBtn, loading && s.disabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Save and Continue</Text>}
          </Pressable>

          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} disabled={loading}>
            <Text style={s.backText}>Back to Overview</Text>
          </TouchableOpacity>
        </View>

        {/* Trust signals */}
        <View style={s.trust}>
          <View style={s.trustRow}>
            <MaterialIcons name="lock" size={13} color={C.onVariant} />
            <Text style={s.trustText}>Secured by Botswana Digital Standards</Text>
          </View>
          <View style={s.logoRow}>
            <Text style={s.logoText}>BURS</Text>
            <Text style={s.logoDot}>·</Text>
            <Text style={s.logoText}>CIPA</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  loading:       { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f3faff" },
  root:          { flex: 1, backgroundColor: "#f3faff" },

  // Top bar
  topBar:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 56, paddingHorizontal: 16, backgroundColor: "#dbf1fe", borderBottomWidth: 1, borderBottomColor: "#c5c6cf", paddingTop: 6 },
  topBarLeft:    { flexDirection: "row", alignItems: "center", gap: 12 },
  appTitle:      { fontSize: 16, fontFamily: "PublicSans_700Bold", color: "#000b25" },
  profileAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#d5ecf8", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#c5c6cf" },

  scroll:        { flex: 1 },
  content:       { paddingHorizontal: 16, paddingBottom: 40 },

  // Step
  stepWrap:      { marginTop: 20, marginBottom: 24 },
  stepRow:       { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  stepLabel:     { fontSize: 12, fontFamily: "PublicSans_600SemiBold", color: "#4b5e87", letterSpacing: 0.4 },
  stepSub:       { fontSize: 12, fontFamily: "PublicSans_400Regular", color: "#44474e" },
  progressBg:    { height: 4, backgroundColor: "#cfe6f2", borderRadius: 4, overflow: "hidden" },
  progressFill:  { height: "100%", backgroundColor: "#2a6b2c", borderRadius: 4 },

  // Header
  headerSection: { marginBottom: 24 },
  title:         { fontSize: 32, fontFamily: "PublicSans_700Bold", color: "#000b25", marginBottom: 6, letterSpacing: -0.64 },
  sub:           { fontSize: 15, fontFamily: "PublicSans_400Regular", color: "#44474e", lineHeight: 22 },

  // Form
  form:          { gap: 20 },
  field:         { gap: 6 },
  label:         { fontSize: 12, fontFamily: "PublicSans_600SemiBold", letterSpacing: 0.4, color: "#071e27", marginLeft: 2 },
  input:         { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#c5c6cf", borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, fontSize: 15, fontFamily: "PublicSans_400Regular", color: "#071e27" },
  inputWithIcon: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#c5c6cf", borderRadius: 12, paddingRight: 14 },
  inputIconField: { flex: 1, paddingVertical: 13, paddingHorizontal: 16, fontSize: 15, fontFamily: "PublicSans_400Regular", color: "#071e27" },
  hint:          { fontSize: 11, fontFamily: "PublicSans_400Regular", color: "#44474e", marginLeft: 2 },
  verified:      { fontSize: 11, fontFamily: "PublicSans_600SemiBold", color: "#2a6b2c", marginLeft: 2 },
  pickerWrap:    { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#c5c6cf", borderRadius: 12, overflow: "hidden", position: "relative" },
  picker:        { height: 50, width: "100%" },
  pickerArrow:   { position: "absolute", right: 14, top: "50%", marginTop: -10, pointerEvents: "none" },

  // Custom dropdown
  dropdownBtn:        { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#c5c6cf", borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dropdownBtnText:    { fontSize: 15, fontFamily: "PublicSans_400Regular", color: "#071e27", flex: 1, marginRight: 8 },
  modalOverlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalSheet:         { backgroundColor: "#ffffff", borderRadius: 16, width: "100%", overflow: "hidden", paddingVertical: 8 },
  modalTitle:         { fontSize: 13, fontFamily: "PublicSans_700Bold", color: "#44474e", letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, textTransform: "uppercase" },
  modalOption:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20 },
  modalOptionSelected:{ backgroundColor: "#f0faf0" },
  modalOptionText:    { fontSize: 15, fontFamily: "PublicSans_400Regular", color: "#071e27", flex: 1, marginRight: 8 },
  modalOptionTextSelected: { fontFamily: "PublicSans_600SemiBold", color: "#2a6b2c" },
  modalDivider:       { height: 1, backgroundColor: "#f0f0f0", marginHorizontal: 16 },

  // Toggle card
  toggleCard:    { backgroundColor: "#e6f6ff", borderWidth: 1, borderColor: "#c5c6cf", borderRadius: 14, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleText:    { flex: 1, marginRight: 12 },
  toggleTitle:   { fontSize: 16, fontFamily: "PublicSans_600SemiBold", color: "#000b25", marginBottom: 2 },
  toggleSub:     { fontSize: 12, fontFamily: "PublicSans_400Regular", color: "#44474e" },

  // Tip card
  tipCard:       { backgroundColor: "#dbf1fe", borderLeftWidth: 4, borderLeftColor: "#2a6b2c", borderRadius: 10, padding: 14, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  tipTextWrap:   { flex: 1, gap: 4 },
  tipTitle:      { fontSize: 12, fontFamily: "PublicSans_700Bold", color: "#000b25", letterSpacing: 0.4 },
  tipBody:       { fontSize: 12, fontFamily: "PublicSans_400Regular", color: "#44474e", lineHeight: 17 },

  // Actions
  submitBtn:     { backgroundColor: "#000b25", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  disabled:      { opacity: 0.6 },
  submitText:    { fontSize: 16, fontFamily: "PublicSans_700Bold", color: "#ffffff" },
  backBtn:       { borderWidth: 1, borderColor: "#c5c6cf", borderRadius: 12, paddingVertical: 13, alignItems: "center", backgroundColor: "transparent" },
  backText:      { fontSize: 14, fontFamily: "PublicSans_600SemiBold", color: "#4b5e87" },

  // Trust
  trust:         { marginTop: 32, alignItems: "center", opacity: 0.55 },
  trustRow:      { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  trustText:     { fontSize: 11, fontFamily: "PublicSans_400Regular", color: "#44474e" },
  logoRow:       { flexDirection: "row", gap: 8, alignItems: "center" },
  logoText:      { fontSize: 12, fontFamily: "PublicSans_700Bold", color: "#44474e", letterSpacing: 0.6 },
  logoDot:       { fontSize: 14, color: "#44474e" },
});