Pod::Spec.new do |s|
  s.name           = 'MyTreeLineLogin'
  s.version        = '0.1.0'
  s.summary        = 'MyTree local bridge for official LINE Login SDK'
  s.description    = 'Thin Expo Modules bridge that returns only a LINE OpenID ID token.'
  s.author         = 'MyTree'
  s.homepage       = 'https://mytree.cc'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'LineSDKSwift', '~> 5.0'
  s.source_files = '**/*.{h,m,mm,swift}'
end
