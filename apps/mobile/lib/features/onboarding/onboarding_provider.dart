import 'package:flutter/material.dart';
import '../../core/services/api_service.dart';
import '../../core/theme/iam_themes.dart';

/// Estado del onboarding — maneja diagnósticos, SpIn y perfil.
class OnboardingProvider extends ChangeNotifier {
  final ApiService _api;

  // Paso actual del onboarding (0=diagnóstico, 1=spin, 2=perfil)
  int _currentStep = 0;
  int get currentStep => _currentStep;

  // Diagnósticos seleccionados
  final Set<String> _selectedDiagnoses = {};
  Set<String> get selectedDiagnoses => _selectedDiagnoses;
  String? _primaryDiagnosis;
  String? get primaryDiagnosis => _primaryDiagnosis;

  // SpIn
  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> get categories => _categories;
  List<Map<String, dynamic>> _searchResults = [];
  List<Map<String, dynamic>> get searchResults => _searchResults;
  final Set<String> _selectedTagIds = {};
  Set<String> get selectedTagIds => _selectedTagIds;
  final List<Map<String, dynamic>> _selectedTags = [];
  List<Map<String, dynamic>> get selectedTags => _selectedTags;

  // Perfil
  String? _username;
  String? _displayName;
  String? _birthDate;

  // Tema
  ThemeData _currentTheme = IamThemes.defaultTheme();
  ThemeData get currentTheme => _currentTheme;
  Map<String, dynamic>? _themeConfig;
  Map<String, dynamic>? get themeConfig => _themeConfig;

  // Loading
  bool _isLoading = false;
  bool get isLoading => _isLoading;
  String? _error;
  String? get error => _error;

  static const int maxSpinTotal = 20;
  static const int maxSpinPerCategory = 5;

  static const List<Map<String, String>> availableDiagnoses = [
    {'key': 'TEA', 'label': 'TEA (Autismo)', 'icon': '🧩'},
    {'key': 'TDAH', 'label': 'TDAH', 'icon': '⚡'},
    {'key': 'AACC', 'label': 'Altas Capacidades', 'icon': '🧠'},
    {'key': 'DISLEXIA', 'label': 'Dislexia', 'icon': '📖'},
    {'key': 'AUTOIDENTIFIED', 'label': 'Me identifico (sin diagnóstico formal)', 'icon': '💫'},
    {'key': 'OTHER', 'label': 'Otro', 'icon': '🌈'},
  ];

  OnboardingProvider(this._api);

  // ── Diagnósticos ──

  void toggleDiagnosis(String diagnosis) {
    if (_selectedDiagnoses.contains(diagnosis)) {
      _selectedDiagnoses.remove(diagnosis);
      if (_primaryDiagnosis == diagnosis) {
        _primaryDiagnosis =
            _selectedDiagnoses.isNotEmpty ? _selectedDiagnoses.first : null;
      }
    } else {
      _selectedDiagnoses.add(diagnosis);
      _primaryDiagnosis ??= diagnosis;
    }
    _updateTheme();
    notifyListeners();
  }

  void setPrimaryDiagnosis(String diagnosis) {
    if (_selectedDiagnoses.contains(diagnosis)) {
      _primaryDiagnosis = diagnosis;
      _updateTheme();
      notifyListeners();
    }
  }

  void _updateTheme() {
    if (_primaryDiagnosis == null) {
      _currentTheme = IamThemes.defaultTheme();
      return;
    }
    switch (_primaryDiagnosis) {
      case 'TEA':
        _currentTheme = IamThemes.tea();
        break;
      case 'TDAH':
        _currentTheme = IamThemes.tdah();
        break;
      case 'AACC':
        _currentTheme = IamThemes.aacc();
        break;
      case 'DISLEXIA':
        _currentTheme = IamThemes.dislexia();
        break;
      default:
        _currentTheme = IamThemes.defaultTheme();
    }
  }

  bool get canProceedFromDiagnosis =>
      _selectedDiagnoses.isNotEmpty && _primaryDiagnosis != null;

  // ── SpIn ──

  Future<void> loadCategories() async {
    try {
      _isLoading = true;
      notifyListeners();

      final response = await _api.get('/spin/categories?lang=es');
      _categories = List<Map<String, dynamic>>.from(response['data'] ?? []);
    } catch (e) {
      _error = 'Error cargando categorías';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> searchTags(String query) async {
    if (query.trim().length < 2) {
      _searchResults = [];
      notifyListeners();
      return;
    }

    try {
      final response = await _api.get(
        '/spin/tags?search=${Uri.encodeComponent(query)}&limit=15',
      );
      _searchResults =
          List<Map<String, dynamic>>.from(response['data'] ?? []);
    } catch (e) {
      _searchResults = [];
    }
    notifyListeners();
  }

  bool canAddTag(Map<String, dynamic> tag) {
    if (_selectedTagIds.length >= maxSpinTotal) return false;
    if (_selectedTagIds.contains(tag['id'])) return false;

    // Check per-category limit
    final categoryId = tag['category_id'];
    final categoryCount =
        _selectedTags.where((t) => t['category_id'] == categoryId).length;
    return categoryCount < maxSpinPerCategory;
  }

  void addTag(Map<String, dynamic> tag) {
    if (!canAddTag(tag)) return;
    _selectedTagIds.add(tag['id']);
    _selectedTags.add(tag);
    notifyListeners();
  }

  void removeTag(String tagId) {
    _selectedTagIds.remove(tagId);
    _selectedTags.removeWhere((t) => t['id'] == tagId);
    notifyListeners();
  }

  bool get canProceedFromSpin => _selectedTagIds.isNotEmpty;

  // ── Perfil ──

  void setUsername(String value) => _username = value;
  void setDisplayName(String value) => _displayName = value;
  void setBirthDate(String value) => _birthDate = value;

  bool get canComplete =>
      _displayName != null &&
      _displayName!.trim().isNotEmpty &&
      _birthDate != null;

  // ── Navegación ──

  void nextStep() {
    if (_currentStep < 2) {
      _currentStep++;
      notifyListeners();
    }
  }

  void previousStep() {
    if (_currentStep > 0) {
      _currentStep--;
      notifyListeners();
    }
  }

  // ── Submit ──

  Future<bool> submitOnboarding() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // 1. Save diagnoses
      final diagResponse = await _api.post('/users/me/diagnoses', body: {
        'diagnoses': _selectedDiagnoses.toList(),
        'primary': _primaryDiagnosis,
      });
      _themeConfig = diagResponse['theme'] as Map<String, dynamic>?;

      // 2. Save SpIn
      await _api.post('/users/me/spin', body: {
        'tagIds': _selectedTagIds.toList(),
      });

      // 3. Save profile
      final profileData = <String, dynamic>{};
      if (_displayName != null && _displayName!.trim().isNotEmpty) {
        profileData['displayName'] = _displayName!.trim();
      }
      if (_username != null && _username!.trim().isNotEmpty) {
        profileData['username'] = _username!.trim();
      }
      if (_birthDate != null) {
        profileData['birthDate'] = _birthDate;
      }
      if (profileData.isNotEmpty) {
        await _api.patch('/users/me/profile', body: profileData);
      }

      // 4. Mark onboarding complete
      await _api.post('/users/me/complete');

      return true;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
