import { useState, useEffect, type ChangeEvent, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  Moon,
  Palette,
  Save,
  Sun,
  Trash2,
  User,
  Loader2,
  XCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { userAPI, authAPI, getStoredUsername } from "../services/api";

type TabId = "profile" | "account" | "theme";
type ThemeOption = "light" | "dark";

export interface SettingsPageProps {
  onBack?: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const { setTheme: setGlobalTheme, theme: globalTheme } = useTheme();

  // Feedback States
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Profile Data
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [userData, setUserData] = useState({
    username: "",
    full_name: "",
    email: "",
    bio: "",
    category_preference: "",
  });

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Account
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Theme Local State (to reflect selection before save if needed, or just sync direct)
  const [theme, setTheme] = useState<string>(globalTheme || "light");

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "account" as const, label: "Account", icon: Lock },
    { id: "theme" as const, label: "Theme", icon: Palette },
  ];

  // Fetch data on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const data = await userAPI.getProfile();
      setUserData({
        username: data.username || "",
        full_name: data.full_name || "",
        email: data.email || "",
        bio: data.bio || "",
        category_preference: data.category_preference || "",
      });
      if (data.profile_picture) {
        setProfilePicture(data.profile_picture);
      }
      // If backend has a preference, sync it?
      if (data.theme_preference) {
        setTheme(data.theme_preference);
        setGlobalTheme(data.theme_preference);
      }
    } catch (error) {
      console.error("Failed to load profile", error);
      setErrorMessage("Failed to load profile data.");
    } finally {
      setIsLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 3000);
  };

  const handleBack = () => {
    if (onBack) return onBack();
    window.history.back();
  };

  const handleProfilePictureChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      showError("Please upload a JPG or PNG image.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("Max file size is 5MB.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setProfilePicture(url);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setErrorMessage("");
    try {
      // We check if we need to send FormData or JSON
      // userAPI.updateProfile now handles FormData correctly.
      let dataToSend: any;
      if (selectedFile) {
        // If file is selected, we must use FormData
        const formData = new FormData();
        formData.append("full_name", userData.full_name);
        formData.append("bio", userData.bio);
        formData.append("profile_picture", selectedFile);
        dataToSend = formData;
      } else {
        // If no file, we can just send JSON
        dataToSend = {
          full_name: userData.full_name,
          bio: userData.bio,
          // include other fields if necessary
        };
      }

      await userAPI.updateProfile(dataToSend);

      showSuccess("Profile updated successfully!");
      setSelectedFile(null);
      // Refresh profile to get new image URL from backend
      fetchProfile();
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setErrorMessage("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      showError("Please fill all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("New password and confirm password do not match.");
      return;
    }
    if (newPassword.length < 8) {
      showError("Password should be at least 8 characters.");
      return;
    }

    setIsSaving(true);
    try {
      await authAPI.changePassword({
        old_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      showSuccess("Password changed successfully! Please login again.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // Optionally redirect to login?
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Failed to change password");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTheme = async () => {
    // Save theme via profile update
    setIsSaving(true);
    try {
      await userAPI.updateProfile({ theme_preference: theme });
      showSuccess("Theme preference saved.");
    } catch (err) {
      showError("Failed to save theme.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const ok = window.confirm("WARNING: This will permanently delete your account and all your data. This action CANNOT be undone. Are you sure?");
    if (!ok) return;

    // Double confirmation
    const text = window.prompt("Type 'DELETE' to confirm account deletion:");
    if (text !== "DELETE") {
      if (text !== null) alert("Deletion cancelled. incorrect confirmation text.");
      return;
    }

    setIsSaving(true);
    try {
      await userAPI.deleteAccount();
      alert("Account deleted. Redirecting to home...");
      // Clear local storage
      localStorage.clear();
      window.location.href = "/";
    } catch (err: any) {
      showError(err.message || "Failed to delete account");
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="settings-breakout settings-container">
      {/* Top bar */}
      <header className="settings-topbar">
        <div className="settings-topbar-inner">
          <button className="settings-back" onClick={handleBack} aria-label="Back">
            <ArrowLeft size={18} />
          </button>

          <div className="settings-title">
            <h1>Settings</h1>
            <p>Manage your account and preferences</p>
          </div>

          <div className="flex items-center gap-2">
            {successMessage && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
                <CheckCircle size={16} />
                <span>{successMessage}</span>
              </div>
            )}
            {errorMessage && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
                <XCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="settings-main">
        <div className="settings-panel">
          <div className="settings-layout">
            {/* Sidebar */}
            <aside className="settings-card settings-sidebar">
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={active ? "active" : ""}
                    onClick={() => setActiveTab(t.id)}
                  >
                    <Icon size={18} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </aside>

            {/* Content */}
            <section className="settings-content-wrap">
              <AnimatePresence mode="wait">
                {/* PROFILE */}
                {activeTab === "profile" && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                    className="settings-card settings-content-card"
                  >
                    <div className="settings-section-head">
                      <div className="settings-section-icon">
                        <User size={18} />
                      </div>
                      <div>
                        <h2>Profile Information</h2>
                        <p>Update your personal details and profile picture</p>
                      </div>
                    </div>

                    <div className="settings-block">
                      <div className="settings-label">Profile Picture</div>

                      <div className="settings-avatar-row">
                        <div className="settings-avatar">
                          {profilePicture ? (
                            <img src={profilePicture} alt="Profile" className="object-cover w-full h-full" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 font-bold text-xl">
                              {userData.username.substring(0, 2).toUpperCase()}
                            </div>
                          )}

                          <label className="settings-avatar-edit" aria-label="Upload photo">
                            <Camera size={18} />
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/png,image/jpeg,image/jpg"
                              onChange={handleProfilePictureChange}
                            />
                          </label>
                        </div>

                        <div className="settings-avatar-text">
                          <div className="settings-avatar-title">Upload a new photo</div>
                          <div className="settings-avatar-sub">JPG or PNG, max 5MB</div>
                        </div>
                      </div>
                    </div>

                    <div className="settings-form">
                      <div>
                        <label className="settings-label">Username</label>
                        <input
                          className="settings-input bg-gray-50 text-gray-500 cursor-not-allowed"
                          value={userData.username}
                          readOnly
                          disabled
                        />
                        <p className="text-xs text-gray-400 mt-1">Username cannot be changed</p>
                      </div>

                      <div>
                        <label className="settings-label">Full Name</label>
                        <input
                          className="settings-input"
                          value={userData.full_name}
                          onChange={(e) => setUserData({ ...userData, full_name: e.target.value })}
                          placeholder="Your full name"
                        />
                      </div>

                      <div>
                        <label className="settings-label">Email Address</label>
                        <input
                          className="settings-input bg-gray-50 text-gray-500 cursor-not-allowed"
                          value={userData.email}
                          readOnly
                          disabled
                        />
                        <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                      </div>

                      <div>
                        <label className="settings-label">Bio</label>
                        <textarea
                          className="settings-input settings-textarea"
                          value={userData.bio}
                          onChange={(e) => setUserData({ ...userData, bio: e.target.value })}
                          placeholder="Tell us a little about yourself"
                        />
                      </div>

                      <div className="settings-actions">
                        <button
                          className="settings-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          type="button"
                          onClick={handleSaveProfile}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                          {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ACCOUNT */}
                {activeTab === "account" && (
                  <motion.div
                    key="account"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                    className="settings-card settings-content-card"
                  >
                    <div className="settings-section-head">
                      <div className="settings-section-icon">
                        <Lock size={18} />
                      </div>
                      <div>
                        <h2>Account Settings</h2>
                        <p>Manage password and account actions</p>
                      </div>
                    </div>

                    <div className="settings-form">
                      <div>
                        <label className="settings-label">Current Password</label>
                        <div className="settings-password-wrap">
                          <input
                            className="settings-input"
                            type={showCurrent ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            className="settings-eye"
                            onClick={() => setShowCurrent((s) => !s)}
                            aria-label="Toggle current password"
                          >
                            {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="settings-label">New Password</label>
                        <div className="settings-password-wrap">
                          <input
                            className="settings-input"
                            type={showNew ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                          />
                          <button
                            type="button"
                            className="settings-eye"
                            onClick={() => setShowNew((s) => !s)}
                            aria-label="Toggle new password"
                          >
                            {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="settings-label">Confirm New Password</label>
                        <div className="settings-password-wrap">
                          <input
                            className="settings-input"
                            type={showConfirm ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                          />
                          <button
                            type="button"
                            className="settings-eye"
                            onClick={() => setShowConfirm((s) => !s)}
                            aria-label="Toggle confirm password"
                          >
                            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div className="settings-actions settings-actions-split">
                        <button
                          className="settings-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          type="button"
                          onClick={handleChangePassword}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                          {isSaving ? "Updating..." : "Update Password"}
                        </button>

                        <div className="settings-hint">
                          <AlertCircle size={16} />
                          <span>Minimum 8 characters</span>
                        </div>
                      </div>

                      <div className="settings-divider" />

                      <div className="settings-danger-zone">
                        <div className="settings-danger-text">
                          <h3>Danger Zone</h3>
                          <p>Delete your account permanently</p>
                        </div>
                        <button
                          className="settings-danger disabled:opacity-50 disabled:cursor-not-allowed"
                          type="button"
                          onClick={handleDeleteAccount}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                          Delete Account
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* THEME */}
                {activeTab === "theme" && (
                  <motion.div
                    key="theme"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                    className="settings-card settings-content-card"
                  >
                    <div className="settings-section-head">
                      <div className="settings-section-icon">
                        <Palette size={18} />
                      </div>
                      <div>
                        <h2>Theme</h2>
                        <p>Choose appearance</p>
                      </div>
                    </div>

                    <div className="settings-theme-grid">
                      <button
                        type="button"
                        className={`settings-theme-card ${theme === "light" ? "active" : ""}`}
                        onClick={() => { setTheme("light"); setGlobalTheme("light"); }}
                      >
                        <div className="settings-theme-head">
                          <div className="settings-theme-left">
                            <Sun size={18} />
                            <span>Light</span>
                          </div>
                          {theme === "light" && <CheckCircle size={18} />}
                        </div>
                        <p>Bright background with dark text</p>
                      </button>

                      <button
                        type="button"
                        className={`settings-theme-card ${theme === "dark" ? "active" : ""}`}
                        onClick={() => { setTheme("dark"); setGlobalTheme("dark"); }}
                      >
                        <div className="settings-theme-head">
                          <div className="settings-theme-left">
                            <Moon size={18} />
                            <span>Dark</span>
                          </div>
                          {theme === "dark" && <CheckCircle size={18} />}
                        </div>
                        <p>Dim background for low light</p>
                      </button>
                    </div>

                    <div className="settings-actions">
                      <button
                        className="settings-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                        onClick={handleSaveTheme}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Save Theme
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export const Settings = SettingsPage;
export default SettingsPage;
