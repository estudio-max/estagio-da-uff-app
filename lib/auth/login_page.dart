import 'package:material_ui/material_ui.dart';

import '../telas/comum.dart';
import '../telas/tema.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({required this.onEntrar, this.onGoogle, super.key});

  final Future<void> Function(String email, String senha) onEntrar;

  /// D26: entrada com o Google (`@id.uff.br`). Nulo esconde o botão.
  final Future<void> Function()? onGoogle;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController();
  final _senha = TextEditingController();
  String? _erro;
  bool _enviando = false;

  @override
  void dispose() {
    _email.dispose();
    _senha.dispose();
    super.dispose();
  }

  Future<void> _tentar(
    Future<void> Function() acao,
    String mensagemDeErro,
  ) async {
    setState(() {
      _enviando = true;
      _erro = null;
    });
    try {
      await acao();
    } on Exception {
      if (mounted) setState(() => _erro = mensagemDeErro);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _entrar() => _tentar(
    () => widget.onEntrar(_email.text.trim(), _senha.text),
    'E-mail ou senha inválidos.',
  );

  Future<void> _google() => _tentar(
    widget.onGoogle!,
    'Não foi possível entrar com o Google. Use sua conta @id.uff.br.',
  );

  Widget _formulario(BuildContext context) {
    final tema = Theme.of(context).textTheme;
    final google = widget.onGoogle != null;
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 400),
      child: AutofillGroup(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Acesso ao sistema', style: tema.headlineMedium),
            const SizedBox(height: 8),
            Text(
              'Restrito à Divisão de Estágio da PROGRAD.',
              style: tema.bodyLarge?.copyWith(color: Cores.textoFraco),
            ),
            const SizedBox(height: 28),
            if (google) ...[
              FilledButton(
                onPressed: _enviando ? null : _google,
                style: FilledButton.styleFrom(minimumSize: const Size(64, 52)),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _MarcaGoogle(),
                    SizedBox(width: 12),
                    Flexible(child: Text('Entrar com a conta Google da UFF')),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Use seu e-mail @id.uff.br',
                textAlign: TextAlign.center,
                style: tema.bodySmall?.copyWith(color: Cores.textoFraco),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  const Expanded(child: Divider(color: Cores.borda)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      'ou com e-mail e senha',
                      style: tema.bodySmall?.copyWith(color: Cores.textoFraco),
                    ),
                  ),
                  const Expanded(child: Divider(color: Cores.borda)),
                ],
              ),
              const SizedBox(height: 20),
            ],
            TextField(
              controller: _email,
              decoration: const InputDecoration(labelText: 'E-mail'),
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _senha,
              decoration: const InputDecoration(labelText: 'Senha'),
              obscureText: true,
              autofillHints: const [AutofillHints.password],
              onSubmitted: (_) => _enviando ? null : _entrar(),
            ),
            if (_erro != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  _erro!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            const SizedBox(height: 20),
            if (google)
              OutlinedButton(
                onPressed: _enviando ? null : _entrar,
                style: OutlinedButton.styleFrom(foregroundColor: Cores.azul),
                child: const Text('Entrar'),
              )
            else
              FilledButton(
                onPressed: _enviando ? null : _entrar,
                child: const Text('Entrar'),
              ),
            if (_enviando)
              const Padding(
                padding: EdgeInsets.only(top: 16),
                child: LinearProgressIndicator(),
              ),
          ],
        ),
      ),
    );
  }

  static const _rodape = Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Image(
        image: AssetImage('assets/identidade/prograd.png'),
        width: 200,
        semanticLabel: 'PROGRAD, Divisão de Estágio',
      ),
      SizedBox(height: 8),
      Text(
        'Universidade Federal Fluminense',
        style: TextStyle(fontSize: 12, color: Cores.textoFraco),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    body: LayoutBuilder(
      builder: (context, c) {
        final largo = c.maxWidth >= larguraLarga;
        final logo = Image.asset(
          'assets/identidade/logo.png',
          width: largo ? 240 : 120,
          semanticLabel: 'Estágios UFF',
        );
        final formulario = Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!largo) ...[logo, const SizedBox(height: 32)],
              _formulario(context),
              const SizedBox(height: 40),
              _rodape,
            ],
          ),
        );
        if (!largo) {
          return Center(child: SingleChildScrollView(child: formulario));
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: ColoredBox(
                color: Cores.ceu,
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        logo,
                        const SizedBox(height: 32),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 380),
                          child: const Text(
                            'Convênios de estágio da UFF, do pedido da '
                            'concedente à publicação no Boletim de Serviço.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 18,
                              height: 1.5,
                              color: Color(0xFF2B3A52),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: Center(child: SingleChildScrollView(child: formulario)),
            ),
          ],
        );
      },
    ),
  );
}

/// O "G" do Google num quadrado branco, como pedem as diretrizes de marca.
class _MarcaGoogle extends StatelessWidget {
  const _MarcaGoogle();

  @override
  Widget build(BuildContext context) => Container(
    width: 28,
    height: 28,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(6),
    ),
    child: const Text(
      'G',
      style: TextStyle(
        color: Color(0xFF4285F4),
        fontWeight: FontWeight.w700,
        fontSize: 17,
      ),
    ),
  );
}
