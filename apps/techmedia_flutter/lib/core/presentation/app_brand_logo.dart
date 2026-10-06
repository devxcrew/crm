import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../config/app_config.dart';

class AppBrandLogo extends StatelessWidget {
  const AppBrandLogo({super.key, this.width, this.height});

  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    final logoAsset = AppConfig.logoAsset;
    if (logoAsset.toLowerCase().endsWith('.svg')) {
      return SvgPicture.asset(
        logoAsset,
        width: width,
        height: height,
        fit: BoxFit.contain,
      );
    }
    return Image.asset(
      logoAsset,
      width: width,
      height: height,
      fit: BoxFit.contain,
    );
  }
}
