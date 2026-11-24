import 'package:material_ui/material_ui.dart';

/// Cores da identidade visual, tiradas dos logos da pasta 0-Identidade.
abstract final class Cores {
  /// Azul do "uff" do logo: ação principal.
  static const azul = Color(0xFF2056AE);
  static const azulEscuro = Color(0xFF163F82);

  /// Marinho: menu lateral e títulos.
  static const marinho = Color(0xFF12294F);
  static const marinhoClaro = Color(0xFF2A4470);

  /// Texto do menu lateral sobre o marinho.
  static const menuTexto = Color(0xFFD5DEEC);
  static const menuTextoFraco = Color(0xFFB9C7DE);

  /// Céu: destaques suaves (fundo do logo na entrada).
  static const ceu = Color(0xFFE6F0FA);
  static const fundo = Color(0xFFF5F8FC);
  static const superficie = Colors.white;

  static const texto = Color(0xFF1B2433);
  static const textoFraco = Color(0xFF5B6474);
  static const borda = Color(0xFFDCE3EE);
  static const bordaCampo = Color(0xFFC3CEDE);
  static const trilho = Color(0xFFE6EBF2);

  /// Alerta de vencimento próximo (até 30 dias).
  static const alerta = Color(0xFFC2410C);
  static const alertaTexto = Color(0xFF8A2E08);
  static const alertaFundo = Color(0xFFFFF4EC);

  /// Faixa da demonstração.
  static const avisoFundo = Color(0xFFFFF3DC);
  static const avisoTexto = Color(0xFF6B4100);
}

const fonteTitulos = 'Exo 2';
const fonteTexto = 'Inter';

const _raio = BorderRadius.all(Radius.circular(10));

/// Tema do app: Inter no texto, Exo 2 nos títulos (ecoa o wordmark "Estágios").
ThemeData temaEstagios() {
  final esquema = ColorScheme.fromSeed(seedColor: Cores.azul).copyWith(
    primary: Cores.azul,
    onPrimary: Colors.white,
    secondary: Cores.marinho,
    onSecondary: Colors.white,
    surface: Cores.superficie,
    onSurface: Cores.texto,
    onSurfaceVariant: Cores.textoFraco,
    outline: Cores.bordaCampo,
    outlineVariant: Cores.borda,
    surfaceContainerLowest: Colors.white,
    surfaceContainerLow: Cores.fundo,
    surfaceContainer: Cores.fundo,
    surfaceContainerHigh: Colors.white,
    surfaceContainerHighest: Cores.trilho,
  );
  final base = ThemeData(
    colorScheme: esquema,
    useMaterial3: true,
    fontFamily: fonteTexto,
  );
  final texto = base.textTheme;
  TextStyle? titulo(TextStyle? s, {FontWeight peso = FontWeight.w700}) =>
      s?.copyWith(
        fontFamily: fonteTitulos,
        fontWeight: peso,
        color: Cores.marinho,
      );
  const botao = TextStyle(
    fontFamily: fonteTexto,
    fontWeight: FontWeight.w600,
    fontSize: 15,
  );
  const tamanhoBotao = Size(64, 44);
  return base.copyWith(
    scaffoldBackgroundColor: Cores.fundo,
    textTheme: texto.copyWith(
      headlineLarge: titulo(texto.headlineLarge),
      headlineMedium: titulo(texto.headlineMedium),
      headlineSmall: titulo(texto.headlineSmall),
      titleLarge: titulo(texto.titleLarge, peso: FontWeight.w600),
      titleMedium: texto.titleMedium?.copyWith(
        fontWeight: FontWeight.w600,
        color: Cores.marinho,
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Cores.fundo,
      foregroundColor: Cores.marinho,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      titleTextStyle: TextStyle(
        fontFamily: fonteTitulos,
        fontWeight: FontWeight.w700,
        fontSize: 22,
        color: Cores.marinho,
      ),
    ),
    cardTheme: const CardThemeData(
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(16)),
        side: BorderSide(color: Cores.borda),
      ),
    ),
    dividerTheme: const DividerThemeData(color: Cores.trilho, space: 1),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: _raio,
        borderSide: BorderSide(color: Cores.bordaCampo),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: _raio,
        borderSide: BorderSide(color: Cores.bordaCampo),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: _raio,
        borderSide: BorderSide(color: Cores.azul, width: 2),
      ),
      contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: tamanhoBotao,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        shape: const RoundedRectangleBorder(borderRadius: _raio),
        textStyle: botao,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: tamanhoBotao,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        foregroundColor: Cores.texto,
        side: const BorderSide(color: Cores.bordaCampo),
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(borderRadius: _raio),
        textStyle: botao.copyWith(fontWeight: FontWeight.w500),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(48, 40),
        shape: const RoundedRectangleBorder(borderRadius: _raio),
        textStyle: botao.copyWith(fontWeight: FontWeight.w500, fontSize: 14),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: Cores.azul,
      foregroundColor: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(16)),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Colors.white,
      selectedColor: Cores.marinho,
      checkmarkColor: Colors.white,
      side: const BorderSide(color: Cores.bordaCampo),
      shape: const StadiumBorder(),
      labelStyle: WidgetStateTextStyle.resolveWith(
        (estados) => TextStyle(
          fontFamily: fonteTexto,
          fontWeight: FontWeight.w500,
          fontSize: 14,
          color: estados.contains(WidgetState.selected)
              ? Colors.white
              : Cores.texto,
        ),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: const Color(0xFFE5EEFB),
      surfaceTintColor: Colors.transparent,
      labelTextStyle: WidgetStateTextStyle.resolveWith(
        (estados) => TextStyle(
          fontFamily: fonteTexto,
          fontSize: 12,
          fontWeight: estados.contains(WidgetState.selected)
              ? FontWeight.w600
              : FontWeight.w500,
          color: estados.contains(WidgetState.selected)
              ? Cores.azul
              : Cores.textoFraco,
        ),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: Cores.marinho,
    ),
    dialogTheme: const DialogThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(16)),
      ),
    ),
    listTileTheme: const ListTileThemeData(iconColor: Cores.textoFraco),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: Cores.azul,
      linearTrackColor: Cores.trilho,
    ),
  );
}
