import { useState } from "react";
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
  Switch, TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { MaterialIcons } from "@expo/vector-icons";
import { useFonts, PublicSans_400Regular, PublicSans_600SemiBold, PublicSans_700Bold } from "@expo-google-fonts/public-sans";
import { api } from "@/lib/api";

type CompanyType = "sole_trader" | "pty_ltd" | "partnership" | "ngo";

export default function BusinessProfileScreen() {
  const [businessName, setBusinessName] = useState("");
  const [companyType, setCompanyType] = useState<CompanyType>("pty_ltd");
  const [cipaNumber, setCipaNumber] = useState("");
  const [bursTin, setBursTin] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatFilingMonthly, setVatFilingMonthly] = useState(true);
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    PublicSans_400Regular,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4b5e87" />
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!businessName.trim()) {
      Alert.alert("Validation", "Business name is required.");
      return;
    }
    if (!companyType) {
      Alert.alert("Validation", "Please select a company type.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        business_name: businessName.trim(),
        company_type: companyType,
        cipa_number: cipaNumber.trim() || null,
        burs_tin: bursTin.trim() || null,
        vat_registered: vatRegistered,
        vat_filing_monthly: vatFilingMonthly,
      };
      await api.post("/business/profile", payload);
      // Success – redirect to main tabs
      router.replace("/(tabs)");
    } catch (err: any) {
      if (err?.response?.status === 409) {
        // Profile already exists – probably user revisited the screen
        Alert.alert("Info", "Business profile already exists. Taking you to the dashboard.");
        router.replace("/(tabs)");
      } else {
        const msg = err?.response?.data?.detail?.message ?? "Failed to create profile. Please try again.";
        Alert.alert("Error", msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Step indicator */}
      <View style={styles.stepContainer}>
        <View style={styles.stepRow}>
          <Text style={styles.stepLabel}>Step 2 of 4</Text>
          <Text style={styles.stepSubLabel}>Business Core Details</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: "50%" }]} />
        </View>
      </View>

      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.title}>Business Profile</Text>
        <Text style={styles.subtitle}>
          Provide your registered company information to synchronize with BURS and CIPA systems.
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Business Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Business Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Kgale Tech Solutions"
            placeholderTextColor="#a0a3ab"
            value={businessName}
            onChangeText={setBusinessName}
          />
          <Text style={styles.hint}>Must match your CIPA certificate exactly.</Text>
        </View>

        {/* Company Type */}
        <View style={styles.field}>
          <Text style={styles.label}>Company Type</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={companyType}
              onValueChange={(val) => setCompanyType(val as CompanyType)}
              style={styles.picker}
            >
              <Picker.Item label="Pty Ltd (Private Limited Company)" value="pty_ltd" />
              <Picker.Item label="Sole Trader" value="sole_trader" />
              <Picker.Item label="Partnership" value="partnership" />
              <Picker.Item label="NGO / Non-Profit" value="ngo" />
            </Picker>
          </View>
        </View>

        {/* CIPA Number */}
        <View style={styles.field}>
          <Text style={styles.label}>CIPA Registration Number</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={styles.inputIconField}
              placeholder="BW-00000000"
              placeholderTextColor="#a0a3ab"
              value={cipaNumber}
              onChangeText={setCipaNumber}
            />
            {cipaNumber.length > 0 && (
              <MaterialIcons name="check-circle" size={20} color="#2a6b2c" style={styles.inputIcon} />
            )}
          </View>
          {cipaNumber.length > 0 && (
            <Text style={styles.verifiedHint}>Verified with CIPA</Text>
          )}
        </View>

        {/* BURS TIN */}
        <View style={styles.field}>
          <Text style={styles.label}>BURS Tax Identification Number (TIN)</Text>
          <TextInput
            style={styles.input}
            placeholder="9 Digit Number"
            placeholderTextColor="#a0a3ab"
            keyboardType="numeric"
            value={bursTin}
            onChangeText={setBursTin}
          />
          <Text style={styles.hint}>Your unique 9-digit tax identifier issued by BURS.</Text>
        </View>

        {/* VAT Toggle Card */}
        <View style={styles.vatCard}>
          <View style={styles.vatText}>
            <Text style={styles.vatTitle}>VAT Registration</Text>
            <Text style={styles.vatSub}>Is your business registered for VAT?</Text>
          </View>
          <Switch
            value={vatRegistered}
            onValueChange={setVatRegistered}
            trackColor={{ false: "#c5c6cf", true: "#2a6b2c" }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Conditional VAT Filing Frequency (only shown if vatRegistered is true) */}
        {vatRegistered && (
          <View style={styles.vatCard}>
            <View style={styles.vatText}>
              <Text style={styles.vatTitle}>VAT Filing Frequency</Text>
              <Text style={styles.vatSub}>Do you file monthly?</Text>
            </View>
            <Switch
              value={vatFilingMonthly}
              onValueChange={setVatFilingMonthly}
              trackColor={{ false: "#c5c6cf", true: "#2a6b2c" }}
              thumbColor="#ffffff"
            />
          </View>
        )}

        {/* Compliance Tip Card */}
        <View style={styles.tipCard}>
          <MaterialIcons name="info" size={20} color="#2a6b2c" />
          <View style={styles.tipTextContainer}>
            <Text style={styles.tipTitle}>Pro-Compliance Tip</Text>
            <Text style={styles.tipBody}>
              Ensuring your TIN is correct now avoids filing delays during the Annual Tax Season in Gaborone and beyond.
            </Text>
          </View>
        </View>

        {/* Buttons */}
        <Pressable
          style={[styles.submitButton, loading && styles.disabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>Save and Continue</Text>
          )}
        </Pressable>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>Back to Overview</Text>
        </TouchableOpacity>
      </View>

      {/* Trust Signals */}
      <View style={styles.trustContainer}>
        <View style={styles.lockRow}>
          <MaterialIcons name="lock" size={14} color="#44474e" />
          <Text style={styles.trustText}>Secured by Botswana Digital Standards</Text>
        </View>
        <View style={styles.logoRow}>
          <Text style={styles.logoPlaceholder}>BURS</Text>
          <Text style={styles.logoPlaceholder}>CIPA</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ----- Styles (matches design system) -----
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3faff",
  },
  container: {
    flex: 1,
    backgroundColor: "#f3faff",
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  stepContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  stepLabel: {
    fontSize: 12,
    fontFamily: "PublicSans_600SemiBold",
    letterSpacing: 0.6,
    color: "#4b5e87",
  },
  stepSubLabel: {
    fontSize: 12,
    fontFamily: "PublicSans_400Regular",
    color: "#44474e",
  },
  progressBarBg: {
    height: 4,
    backgroundColor: "#cfe6f2",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#2a6b2c",
    borderRadius: 4,
  },
  headerSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: "PublicSans_700Bold",
    color: "#000b25",
    marginBottom: 6,
    letterSpacing: -0.64,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "PublicSans_400Regular",
    color: "#44474e",
    lineHeight: 24,
  },
  form: {
    gap: 20,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: "PublicSans_600SemiBold",
    letterSpacing: 0.6,
    color: "#071e27",
    marginLeft: 4,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#c5c6cf",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "PublicSans_400Regular",
    color: "#071e27",
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#c5c6cf",
    borderRadius: 12,
    paddingRight: 16,
  },
  inputIconField: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "PublicSans_400Regular",
    color: "#071e27",
  },
  inputIcon: {
    marginLeft: 8,
  },
  hint: {
    fontSize: 11,
    fontFamily: "PublicSans_400Regular",
    color: "#44474e",
    marginLeft: 4,
  },
  verifiedHint: {
    fontSize: 11,
    fontFamily: "PublicSans_600SemiBold",
    color: "#2a6b2c",
    marginLeft: 4,
  },
  pickerContainer: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#c5c6cf",
    borderRadius: 12,
    overflow: "hidden",
  },
  picker: {
    height: 48,
    width: "100%",
  },
  vatCard: {
    backgroundColor: "#e6f6ff",
    borderWidth: 1,
    borderColor: "#c5c6cf",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vatText: {
    flex: 1,
    marginRight: 12,
  },
  vatTitle: {
    fontSize: 16,
    fontFamily: "PublicSans_600SemiBold",
    color: "#000b25",
    marginBottom: 2,
  },
  vatSub: {
    fontSize: 12,
    fontFamily: "PublicSans_400Regular",
    color: "#44474e",
  },
  tipCard: {
    backgroundColor: "#dbf1fe",
    borderLeftWidth: 4,
    borderLeftColor: "#2a6b2c",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  tipTextContainer: {
    flex: 1,
    gap: 4,
  },
  tipTitle: {
    fontSize: 12,
    fontFamily: "PublicSans_600SemiBold",
    letterSpacing: 0.6,
    color: "#000b25",
  },
  tipBody: {
    fontSize: 11,
    fontFamily: "PublicSans_400Regular",
    color: "#44474e",
  },
  submitButton: {
    backgroundColor: "#000b25",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "PublicSans_600SemiBold",
    color: "#ffffff",
  },
  backButton: {
    borderWidth: 1,
    borderColor: "#c5c6cf",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: "PublicSans_600SemiBold",
    color: "#4b5e87",
  },
  trustContainer: {
    marginTop: 32,
    alignItems: "center",
    opacity: 0.6,
  },
  lockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  trustText: {
    fontSize: 11,
    fontFamily: "PublicSans_400Regular",
    color: "#44474e",
  },
  logoRow: {
    flexDirection: "row",
    gap: 16,
  },
  logoPlaceholder: {
    fontSize: 12,
    fontFamily: "PublicSans_600SemiBold",
    color: "#44474e",
    letterSpacing: 0.6,
  },
});