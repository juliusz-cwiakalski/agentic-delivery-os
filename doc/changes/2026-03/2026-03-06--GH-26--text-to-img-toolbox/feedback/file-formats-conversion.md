make sure that we support conversion to avif and webp output formats.
we should have a logic recorded that knows what is native image format produced by each provider and model.
then check if file format specified by user if natively supported, if not then it should verify if we have required
conversion tools installed (use common tools working on ubuntu) if not then it should report back the issue that we're
missing converse and it should be installed or user should select different supported image format (the native from
model or other supported conversion format - it should make it clear what is the native format and what is the available
conversion formats).

we could actually also support output file name without the extension and then the tool could simply choose the native
extension format of the provider/model or the one specified by user if it's supported natively or via conversion.
This would make it easier for users who don't care about specific formats and just want the best quality/size output.
The tool would handle the logic of choosing the right format based on provider/model capabilities and user preferences.
